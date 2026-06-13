/**
 * diffdigest public type definitions.
 */

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface DiffDigestOptions {
  format?: "json" | "md" | "text";
  maxTokens?: number;
  /** Drill into a specific file path — returns the raw hunks for that file only */
  file?: string;
  /** GitHub token for private repos / higher rate limit */
  token?: string;
}

// ---------------------------------------------------------------------------
// Change type per file
// ---------------------------------------------------------------------------

export type FileChangeType = "add" | "modify" | "delete" | "rename";

// ---------------------------------------------------------------------------
// A single hunk summary
// ---------------------------------------------------------------------------

export interface HunkSummary {
  /** Header line, e.g. "@@ -10,7 +10,9 @@" */
  header: string;
  /** Number of lines added in this hunk */
  additions: number;
  /** Number of lines deleted in this hunk */
  deletions: number;
}

// ---------------------------------------------------------------------------
// A per-file change entry
// ---------------------------------------------------------------------------

export interface FileChange {
  /** File path (new path for renames) */
  path: string;
  /** Previous path for renames */
  fromPath?: string;
  changeType: FileChangeType;
  hunkCount: number;
  /** Net line delta: additions - deletions */
  netLines: number;
  additions: number;
  deletions: number;
  hunks: HunkSummary[];
  /**
   * Changed symbol names extracted by lightweight regex from TS/JS hunks.
   * e.g. function names, class names, export identifiers.
   */
  changedSymbols: string[];
}

// ---------------------------------------------------------------------------
// Risk signals
// ---------------------------------------------------------------------------

export interface RiskSignals {
  /** Logic files were changed but no corresponding test file was modified */
  missingTests: boolean;
  /** Schema or migration files were touched */
  schemaTouched: boolean;
  /** Lines matching auth / secret / credential patterns were added */
  authOrSecretPatterns: boolean;
  /** Names of files that triggered each risk signal */
  triggerFiles: {
    missingTests: string[];
    schema: string[];
    authOrSecret: string[];
  };
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export interface DiffDigestStats {
  tokenEstimate: number;
  rawEstimate: number;
  savedPercent: number;
  totalFiles: number;
  totalAdditions: number;
  totalDeletions: number;
}

// ---------------------------------------------------------------------------
// Top-level digest
// ---------------------------------------------------------------------------

export interface DiffDigest {
  /** Source: "file", "stdin", or "github-pr" */
  source: string;
  summary: {
    totalFiles: number;
    additions: number;
    deletions: number;
    netLines: number;
  };
  files: FileChange[];
  riskSignals: RiskSignals;
  stats: DiffDigestStats;
  generatedAt: string;
}
