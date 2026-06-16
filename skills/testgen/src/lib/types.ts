/**
 * testgen public type definitions.
 */

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export type TestFramework = "vitest" | "jest";

export interface TestGenOptions {
  format?: "json" | "md" | "text";
  maxTokens?: number;
  /** Framework to generate tests for (default: vitest) */
  framework?: TestFramework;
  /** Drill into a single function by name */
  functionName?: string;
}

// ---------------------------------------------------------------------------
// A single function parameter
// ---------------------------------------------------------------------------

export interface FunctionParam {
  name: string;
  type: string;
  optional: boolean;
  defaultValue?: string;
}

// ---------------------------------------------------------------------------
// A function signature extracted from source
// ---------------------------------------------------------------------------

export interface FunctionSignature {
  name: string;
  /** "function" | "arrow" | "method" | "async-function" | "async-arrow" | "async-method" */
  kind: string;
  params: FunctionParam[];
  returnType: string;
  /** Whether the function is exported */
  exported: boolean;
  /** Whether the function is async */
  async: boolean;
  /** JSDoc comment, if present */
  jsdoc?: string;
}

// ---------------------------------------------------------------------------
// A single test case
// ---------------------------------------------------------------------------

export interface TestCase {
  /** Short description of what this test covers */
  description: string;
  /** The test case category */
  category: "null" | "undefined" | "empty" | "boundary" | "type-mismatch" | "happy-path" | "error";
  /** The generated test body (code string) */
  body: string;
}

// ---------------------------------------------------------------------------
// Test skeleton for a single function
// ---------------------------------------------------------------------------

export interface FunctionTestSkeleton {
  functionName: string;
  signature: FunctionSignature;
  /** Generated test cases */
  cases: TestCase[];
  /** Import statement needed to import this function */
  importStatement: string;
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export interface TestGenStats {
  tokenEstimate: number;
  /** Estimated tokens if you had to read all source files manually */
  rawEstimate: number;
  savedPercent: number;
  totalFunctions: number;
  totalCases: number;
}

// ---------------------------------------------------------------------------
// Top-level digest
// ---------------------------------------------------------------------------

export interface TestGenDigest {
  /** Source file path */
  sourceFile: string;
  framework: TestFramework;
  skeletons: FunctionTestSkeleton[];
  stats: TestGenStats;
  generatedAt: string;
}
