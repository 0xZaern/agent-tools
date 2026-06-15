/**
 * releasemap public type definitions.
 */

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ReleaseMapOptions {
  format?: "json" | "md" | "text";
  maxTokens?: number;
  /** Show only releases at or after this semver (e.g. "v1.2.0" or "1.2.0") */
  since?: string;
  /** Drill into a single version — return full notes for that release */
  version?: string;
  /** GitHub personal access token for higher rate limits */
  token?: string;
}

// ---------------------------------------------------------------------------
// Source type
// ---------------------------------------------------------------------------

export type ReleaseSource = "changelog" | "github" | "npm";

// ---------------------------------------------------------------------------
// A single release entry
// ---------------------------------------------------------------------------

export interface ReleaseEntry {
  /** Semver string, e.g. "2.1.0" */
  version: string;
  /** ISO date string if available, otherwise null */
  date: string | null;
  /** Whether this release contains breaking changes */
  breaking: boolean;
  /** One-line summary (first non-empty line of the release body) */
  summary: string;
  /** Count of items marked as added / new features */
  added: number;
  /** Count of items marked as changed / improved */
  changed: number;
  /** Count of items marked as fixed / bugfix */
  fixed: number;
  /** Count of items marked as removed / deprecated */
  removed: number;
  /**
   * Full release body text — only present when --version drill-down is used,
   * otherwise omitted to save tokens.
   */
  body?: string;
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export interface ReleaseMapStats {
  tokenEstimate: number;
  rawEstimate: number;
  savedPercent: number;
  totalReleases: number;
  breakingCount: number;
}

// ---------------------------------------------------------------------------
// Top-level digest
// ---------------------------------------------------------------------------

export interface ReleaseMapDigest {
  source: ReleaseSource;
  /** What was queried: file path, "owner/repo", or npm package name */
  target: string;
  releases: ReleaseEntry[];
  stats: ReleaseMapStats;
  generatedAt: string;
}
