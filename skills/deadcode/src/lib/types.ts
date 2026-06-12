/**
 * deadcode public type definitions.
 */

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface DeadCodeOptions {
  format?: "json" | "text" | "md";
  /** Maximum number of dead-export entries to return (default: unlimited) */
  limit?: number;
  /** Maximum directory traversal depth (default: unlimited) */
  maxDepth?: number;
}

// ---------------------------------------------------------------------------
// A single dead export entry
// ---------------------------------------------------------------------------

export type ExportKind = "function" | "class" | "type" | "const" | "enum" | "default" | "re-export" | "unknown";

export interface DeadExport {
  /** Name of the exported symbol */
  name: string;
  /** Kind of the export */
  kind: ExportKind;
  /** 1-based line number where the export is declared */
  line: number;
}

// ---------------------------------------------------------------------------
// Dead exports grouped by file
// ---------------------------------------------------------------------------

export interface DeadFile {
  /** Path relative to project root */
  path: string;
  /** Dead exports in this file */
  exports: DeadExport[];
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export interface DeadCodeStats {
  /** Approximate tokens for this digest */
  tokenEstimate: number;
  /** Approximate tokens to read all source files raw */
  rawEstimate: number;
  /** Percentage reduction vs raw */
  savedPercent: number;
  /** Total source files scanned */
  totalFiles: number;
  /** Total named exports found across all files */
  totalExports: number;
  /** Number of exports identified as dead */
  deadCount: number;
  /** Percentage of exports that are dead */
  deadPercent: number;
}

// ---------------------------------------------------------------------------
// Top-level digest
// ---------------------------------------------------------------------------

export interface DeadCodeDigest {
  root: string;
  /** Files containing at least one dead export, sorted by dead-export count desc */
  files: DeadFile[];
  stats: DeadCodeStats;
  generatedAt: string;
}
