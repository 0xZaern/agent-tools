// covergap public types

export interface CoverGapOptions {
  format?: "json" | "text" | "md";
  /** max file entries to return (default: unlimited) */
  limit?: number;
  /** omit files with risk score below this (0-100, default: 0) */
  minRisk?: number;
}

export interface FileCoverage {
  /** path as reported by the coverage tool */
  path: string;
  /** statement coverage %, null if not available */
  statements: number | null;
  /** branch coverage %, null if not available */
  branches: number | null;
  /** function coverage %, null if not available */
  functions: number | null;
  /** line coverage %, null if not available */
  lines: number | null;
  uncoveredLines: number;
  totalLines: number;
  /** 0-100, higher = more urgent to test */
  riskScore: number;
  reason: string;
}

export interface CoverGapStats {
  tokenEstimate: number;
  rawEstimate: number;
  savedPercent: number;
  totalFiles: number;
  /** files with < 80% line coverage */
  undertested: number;
  /** files with 0% line coverage */
  uncovered: number;
  overallLinePct: number | null;
}

export interface CoverGapDigest {
  /** absolute path to the coverage file */
  source: string;
  sourceFormat: "lcov" | "istanbul-json";
  /** ranked by riskScore descending */
  files: FileCoverage[];
  stats: CoverGapStats;
  generatedAt: string;
}
