/**
 * depgraph public type definitions.
 */

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface DepGraphOptions {
  format?: "json" | "md" | "text";
  maxTokens?: number;
  /** Drill into a specific file — show its full import/export list */
  file?: string;
  /** Maximum directory traversal depth (default: unlimited) */
  maxDepth?: number;
}

// ---------------------------------------------------------------------------
// A single import edge
// ---------------------------------------------------------------------------

export interface ImportEdge {
  /** The file being imported from, relative to project root */
  from: string;
  /** The resolved file path of the import target, or the raw specifier if unresolved */
  to: string;
  /** Whether the specifier was resolved to a local file (true) or is external (false) */
  isLocal: boolean;
  /** Named identifiers imported, if available */
  names?: string[];
}

// ---------------------------------------------------------------------------
// A single export
// ---------------------------------------------------------------------------

export interface ExportEntry {
  name: string;
  /** "function" | "class" | "variable" | "type" | "re-export" | "default" */
  kind: string;
}

// ---------------------------------------------------------------------------
// Per-file node in the graph
// ---------------------------------------------------------------------------

export interface FileNode {
  /** Path relative to project root */
  path: string;
  /** Files this file imports from (local only) */
  imports: string[];
  /** Files that import this file */
  importedBy: string[];
  /** Total number of times this file is transitively depended on */
  importedByCount: number;
  /** Named exports from this file */
  exports: ExportEntry[];
}

// ---------------------------------------------------------------------------
// A detected cycle
// ---------------------------------------------------------------------------

export interface Cycle {
  /** The files involved in the cycle, in order */
  files: string[];
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export interface DepGraphStats {
  tokenEstimate: number;
  rawEstimate: number;
  savedPercent: number;
  totalFiles: number;
  totalEdges: number;
  cycleCount: number;
}

// ---------------------------------------------------------------------------
// Top-level digest
// ---------------------------------------------------------------------------

export interface DepGraphDigest {
  root: string;
  /** All file nodes in the graph */
  nodes: FileNode[];
  /** Detected circular dependency chains */
  cycles: Cycle[];
  /** Files not imported by any other file (likely entry points) */
  entryPoints: string[];
  /** Files most frequently imported — sorted by importedByCount desc */
  heaviestSubtrees: Array<{ path: string; importedByCount: number }>;
  stats: DepGraphStats;
  generatedAt: string;
}
