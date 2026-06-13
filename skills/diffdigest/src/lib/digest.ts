/**
 * Top-level diffdigest orchestration: load diff → parse → risk signals →
 * stats → optional token budget trim → return DiffDigest.
 */

import { loadDiff } from "./loader.js";
import { parseDiffText } from "./parse.js";
import { detectRiskSignals } from "./risk.js";
import {
  DiffDigest,
  DiffDigestOptions,
  DiffDigestStats,
  FileChange,
} from "./types.js";

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

function computeStats(
  output: string,
  rawSize: number,
  totalFiles: number,
  totalAdditions: number,
  totalDeletions: number
): DiffDigestStats {
  const tokenEstimate = Math.ceil(output.length / 4);
  const rawEstimate = Math.max(1, Math.ceil(rawSize / 4));
  const savedPercent = Math.max(0, Math.round((1 - tokenEstimate / rawEstimate) * 100));
  return {
    tokenEstimate,
    rawEstimate,
    savedPercent,
    totalFiles,
    totalAdditions,
    totalDeletions,
  };
}

// ---------------------------------------------------------------------------
// Token budget trimming
// ---------------------------------------------------------------------------

function trimToTokenBudget(digest: DiffDigest, maxTokens: number): DiffDigest {
  const estimate = () => Math.ceil(JSON.stringify(digest).length / 4);
  if (estimate() <= maxTokens) return digest;

  // First: drop hunk details, keep counts
  digest = {
    ...digest,
    files: digest.files.map((f) => ({ ...f, hunks: [] })),
  };
  if (estimate() <= maxTokens) return digest;

  // Then: drop changedSymbols
  digest = {
    ...digest,
    files: digest.files.map((f) => ({ ...f, changedSymbols: [] })),
  };
  if (estimate() <= maxTokens) return digest;

  // Then: truncate file list
  const keep = Math.max(1, Math.floor((maxTokens / estimate()) * digest.files.length));
  digest = { ...digest, files: digest.files.slice(0, keep) };

  return digest;
}

// ---------------------------------------------------------------------------
// Drill-down: single file
// ---------------------------------------------------------------------------

function drillDown(digest: DiffDigest, filePath: string): DiffDigest {
  const lower = filePath.toLowerCase();
  const match = digest.files.find(
    (f) => f.path.toLowerCase() === lower || f.path.toLowerCase().endsWith(lower)
  );

  if (!match) {
    throw new Error(
      `File not found in diff: "${filePath}". Available: ${digest.files
        .map((f) => f.path)
        .join(", ")}`
    );
  }

  return {
    ...digest,
    files: [match],
    summary: {
      totalFiles: 1,
      additions: match.additions,
      deletions: match.deletions,
      netLines: match.netLines,
    },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getDiffDigest(
  input: string | null,
  opts: DiffDigestOptions = {}
): Promise<DiffDigest> {
  const { raw, source } = await loadDiff(input, opts.token);
  const rawSize = raw.length;

  const files: FileChange[] = parseDiffText(raw);
  const riskSignals = detectRiskSignals(files, raw);

  const totalAdditions = files.reduce((s, f) => s + f.additions, 0);
  const totalDeletions = files.reduce((s, f) => s + f.deletions, 0);

  const prelim: DiffDigest = {
    source,
    summary: {
      totalFiles: files.length,
      additions: totalAdditions,
      deletions: totalDeletions,
      netLines: totalAdditions - totalDeletions,
    },
    files,
    riskSignals,
    stats: {
      tokenEstimate: 0,
      rawEstimate: 0,
      savedPercent: 0,
      totalFiles: files.length,
      totalAdditions,
      totalDeletions,
    },
    generatedAt: new Date().toISOString(),
  };

  const stats = computeStats(
    JSON.stringify(prelim),
    rawSize,
    files.length,
    totalAdditions,
    totalDeletions
  );

  let digest: DiffDigest = { ...prelim, stats };

  // Drill-down (applied before token budget so drill-down is always full)
  if (opts.file) {
    digest = drillDown(digest, opts.file);
  }

  if (opts.maxTokens) {
    digest = trimToTokenBudget(digest, opts.maxTokens);
    const trimmedStats = computeStats(
      JSON.stringify(digest),
      rawSize,
      digest.files.length,
      digest.summary.additions,
      digest.summary.deletions
    );
    digest = { ...digest, stats: trimmedStats };
  }

  return digest;
}
