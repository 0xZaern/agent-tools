/**
 * Top-level releasemap orchestration: detect source → load data →
 * normalize to ReleaseEntry[] → apply filters → stats → return ReleaseMapDigest.
 */

import {
  detectSourceKind,
  loadChangelogFile,
  loadGithubReleases,
  loadNpmPackage,
} from "./loader.js";
import { parseChangelog } from "./parse-changelog.js";
import {
  ReleaseEntry,
  ReleaseMapDigest,
  ReleaseMapOptions,
  ReleaseMapStats,
  ReleaseSource,
} from "./types.js";

// ---------------------------------------------------------------------------
// Breaking change detection (for GitHub/npm sources)
// ---------------------------------------------------------------------------

const BREAKING_RE = /BREAKING\s+CHANGE|BREAKING:|^!|major\s+version|removed?\s+support/im;

function isBreakingText(text: string): boolean {
  return BREAKING_RE.test(text);
}

// ---------------------------------------------------------------------------
// GitHub releases -> ReleaseEntry[]
// ---------------------------------------------------------------------------

function githubToEntries(
  releases: Awaited<ReturnType<typeof loadGithubReleases>>
): ReleaseEntry[] {
  return releases
    .filter((r) => !r.prerelease)
    .map((r) => {
      const version = r.tag_name.replace(/^v/, "");
      const date = r.published_at ? r.published_at.slice(0, 10) : null;
      const body = r.body ?? "";

      // One-line summary: first non-empty line of body
      let summary = "";
      for (const line of body.split("\n")) {
        const trimmed = line.trim().replace(/^#+\s*/, "").replace(/^[-*]\s*/, "");
        if (trimmed) {
          summary = trimmed.slice(0, 120);
          break;
        }
      }

      const addedMatch = (body.match(/^\s*[-*+]\s+/gm) ?? []).length;
      const fixedMatch = (body.match(/fix(?:ed)?|patch(?:ed)?|bug/gim) ?? []).length;
      const changedMatch = (body.match(/chang(?:ed?)|updat(?:ed?)|improv(?:ed?)/gim) ?? []).length;
      const removedMatch = (body.match(/remov(?:ed?)|deprecat(?:ed?)|drop(?:ped?)/gim) ?? []).length;

      return {
        version,
        date,
        breaking: isBreakingText(body) || isBreakingText(r.name ?? ""),
        summary,
        added: Math.max(0, addedMatch - fixedMatch - changedMatch - removedMatch),
        changed: changedMatch,
        fixed: fixedMatch,
        removed: removedMatch,
        body,
      };
    });
}

// ---------------------------------------------------------------------------
// npm versions -> ReleaseEntry[]
// ---------------------------------------------------------------------------

function npmToEntries(
  versions: Awaited<ReturnType<typeof loadNpmPackage>>
): ReleaseEntry[] {
  return versions.map((v) => ({
    version: v.version,
    date: v.date,
    breaking: false, // npm registry doesn't expose this
    summary: v.description,
    added: 0,
    changed: 0,
    fixed: 0,
    removed: 0,
  }));
}

// ---------------------------------------------------------------------------
// Semver comparison (simple: split by dots)
// ---------------------------------------------------------------------------

function semverGte(a: string, b: string): boolean {
  const pa = a.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va > vb) return true;
    if (va < vb) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

function computeStats(
  output: string,
  rawEstimate: number,
  totalReleases: number,
  breakingCount: number
): ReleaseMapStats {
  const tokenEstimate = Math.ceil(output.length / 4);
  const savedPercent = Math.max(0, Math.round((1 - tokenEstimate / rawEstimate) * 100));
  return { tokenEstimate, rawEstimate, savedPercent, totalReleases, breakingCount };
}

// ---------------------------------------------------------------------------
// Token budget trimming
// ---------------------------------------------------------------------------

function trimToTokenBudget(digest: ReleaseMapDigest, maxTokens: number): ReleaseMapDigest {
  const estimate = () => Math.ceil(JSON.stringify(digest).length / 4);
  if (estimate() <= maxTokens) return digest;

  // Drop body fields
  digest = {
    ...digest,
    releases: digest.releases.map(({ body: _body, ...rest }) => rest),
  };
  if (estimate() <= maxTokens) return digest;

  // Truncate release list
  const keep = Math.max(1, Math.floor((maxTokens / estimate()) * digest.releases.length));
  digest = { ...digest, releases: digest.releases.slice(0, keep) };

  return digest;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getReleaseMap(
  target: string,
  opts: ReleaseMapOptions = {}
): Promise<ReleaseMapDigest> {
  const kind = detectSourceKind(target);
  let releases: ReleaseEntry[] = [];
  let source: ReleaseSource;
  let rawEstimate: number;

  if (kind === "changelog") {
    const text = loadChangelogFile(target);
    rawEstimate = Math.ceil(text.length / 4);
    releases = parseChangelog(text);
    source = "changelog";
  } else if (kind === "github") {
    const ghReleases = await loadGithubReleases(target, opts.token);
    rawEstimate = Math.ceil(
      ghReleases.reduce((s, r) => s + (r.body?.length ?? 0) + 100, 0) / 4
    );
    releases = githubToEntries(ghReleases);
    source = "github";
  } else {
    const npmVersions = await loadNpmPackage(target);
    rawEstimate = Math.ceil(npmVersions.length * 50);
    releases = npmToEntries(npmVersions);
    source = "npm";
  }

  // Apply --since filter
  if (opts.since) {
    releases = releases.filter((r) => semverGte(r.version, opts.since!));
  }

  // Apply --version drill-down (keep body, filter to single release)
  if (opts.version) {
    const vclean = opts.version.replace(/^v/, "");
    const match = releases.find((r) => r.version.replace(/^v/, "") === vclean);
    if (!match) {
      throw new Error(
        `Version not found: "${opts.version}". Available: ${releases
          .slice(0, 5)
          .map((r) => r.version)
          .join(", ")}...`
      );
    }
    releases = [match];
  } else {
    // Strip body from all entries unless drill-down
    releases = releases.map(({ body: _body, ...rest }) => rest);
  }

  const breakingCount = releases.filter((r) => r.breaking).length;

  const prelim: ReleaseMapDigest = {
    source,
    target,
    releases,
    stats: {
      tokenEstimate: 0,
      rawEstimate,
      savedPercent: 0,
      totalReleases: releases.length,
      breakingCount,
    },
    generatedAt: new Date().toISOString(),
  };

  const stats = computeStats(
    JSON.stringify(prelim),
    rawEstimate,
    releases.length,
    breakingCount
  );

  let digest: ReleaseMapDigest = { ...prelim, stats };

  if (opts.maxTokens) {
    digest = trimToTokenBudget(digest, opts.maxTokens);
    const trimmedStats = computeStats(
      JSON.stringify(digest),
      rawEstimate,
      digest.releases.length,
      digest.releases.filter((r) => r.breaking).length
    );
    digest = { ...digest, stats: trimmedStats };
  }

  return digest;
}
