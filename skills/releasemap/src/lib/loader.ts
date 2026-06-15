/**
 * loader: resolves the release data from three possible sources:
 *  1. Local CHANGELOG.md file path
 *  2. GitHub owner/repo slug (reads GitHub Releases API)
 *  3. npm package name (reads npm registry)
 *
 * Returns raw text for changelog, or structured release data for GitHub/npm.
 */

import fs from "node:fs";

// ---------------------------------------------------------------------------
// GitHub Releases
// ---------------------------------------------------------------------------

export interface GithubRelease {
  tag_name: string;
  name: string;
  published_at: string | null;
  body: string;
  prerelease: boolean;
}

export async function loadGithubReleases(
  slug: string,
  token?: string
): Promise<GithubRelease[]> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "releasemap/1.0.0",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const releases: GithubRelease[] = [];
  let page = 1;

  while (true) {
    const url = `https://api.github.com/repos/${slug}/releases?per_page=100&page=${page}`;
    const res = await fetch(url, { headers });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `GitHub API returned ${res.status} for ${url}${body ? `: ${body.slice(0, 200)}` : ""}`
      );
    }

    const page_data = (await res.json()) as GithubRelease[];
    if (!Array.isArray(page_data) || page_data.length === 0) break;

    releases.push(...page_data);

    if (page_data.length < 100) break;
    page++;
    if (page > 10) break; // cap at 1000 releases
  }

  return releases;
}

// ---------------------------------------------------------------------------
// npm registry
// ---------------------------------------------------------------------------

export interface NpmVersionInfo {
  version: string;
  date: string | null;
  description: string;
}

export async function loadNpmPackage(packageName: string): Promise<NpmVersionInfo[]> {
  const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "releasemap/1.0.0" },
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`npm package not found: ${packageName}`);
    }
    throw new Error(`npm registry returned ${res.status} for ${packageName}`);
  }

  const data = (await res.json()) as {
    versions?: Record<string, { description?: string }>;
    time?: Record<string, string>;
    description?: string;
  };

  const versions = data.versions ?? {};
  const time = data.time ?? {};
  const globalDesc = data.description ?? "";

  return Object.keys(versions)
    .filter((v) => !v.includes("-")) // skip pre-releases for cleaner output
    .map((version) => ({
      version,
      date: time[version] ? time[version]!.slice(0, 10) : null,
      description:
        (versions[version]?.description ?? globalDesc).slice(0, 120),
    }))
    .sort((a, b) => {
      // Sort by date descending when available
      if (a.date && b.date) return b.date.localeCompare(a.date);
      return 0;
    });
}

// ---------------------------------------------------------------------------
// Source detection
// ---------------------------------------------------------------------------

export type SourceKind = "changelog" | "github" | "npm";

export function detectSourceKind(target: string): SourceKind {
  // Local file
  if (fs.existsSync(target)) return "changelog";
  // GitHub slug: owner/repo (no spaces, exactly one slash, no dots before slash)
  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(target) && !target.includes("..")) {
    return "github";
  }
  // npm package: @scope/name or plain name
  return "npm";
}

// ---------------------------------------------------------------------------
// Changelog file loader
// ---------------------------------------------------------------------------

export function loadChangelogFile(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, "utf8");
}
