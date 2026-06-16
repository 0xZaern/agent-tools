/**
 * Top-level testgen orchestration: load file → parse signatures → generate
 * cases → stats → return TestGenDigest.
 */

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { extractFunctions } from "./extract.js";
import { generateCases } from "./cases.js";
import {
  FunctionTestSkeleton,
  TestGenDigest,
  TestGenOptions,
  TestGenStats,
  TestFramework,
} from "./types.js";

// ---------------------------------------------------------------------------
// Import statement generation
// ---------------------------------------------------------------------------

function buildImportStatement(
  functions: string[],
  sourceFile: string,
  framework: TestFramework
): string {
  const relative = "./" + path.basename(sourceFile).replace(/\.[cm]?[jt]sx?$/, ".js");
  const names = functions.join(", ");
  return `import { ${names} } from '${relative}';`;
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

function computeStats(
  output: string,
  rawSize: number,
  totalFunctions: number,
  totalCases: number
): TestGenStats {
  const tokenEstimate = Math.ceil(output.length / 4);
  const rawEstimate = Math.max(1, Math.ceil(rawSize / 4));
  const savedPercent = Math.max(0, Math.round((1 - tokenEstimate / rawEstimate) * 100));
  return { tokenEstimate, rawEstimate, savedPercent, totalFunctions, totalCases };
}

// ---------------------------------------------------------------------------
// Token budget trimming
// ---------------------------------------------------------------------------

function trimToTokenBudget(digest: TestGenDigest, maxTokens: number): TestGenDigest {
  const estimate = () => Math.ceil(JSON.stringify(digest).length / 4);
  if (estimate() <= maxTokens) return digest;

  // First: reduce cases per skeleton
  digest = {
    ...digest,
    skeletons: digest.skeletons.map((s) => ({
      ...s,
      cases: s.cases.slice(0, 3),
    })),
  };
  if (estimate() <= maxTokens) return digest;

  // Then: trim to fewer skeletons
  const keep = Math.max(1, Math.floor((maxTokens / estimate()) * digest.skeletons.length));
  digest = { ...digest, skeletons: digest.skeletons.slice(0, keep) };

  return digest;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getTestGen(
  sourcePath: string,
  opts: TestGenOptions = {}
): Promise<TestGenDigest> {
  const framework: TestFramework = opts.framework ?? "vitest";
  const absPath = path.resolve(sourcePath);

  if (!fs.existsSync(absPath)) {
    throw new Error(`File not found: ${absPath}`);
  }

  const rawSource = fs.readFileSync(absPath, "utf8");
  const rawSize = rawSource.length;

  // Parse with TypeScript compiler API
  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    allowJs: true,
    jsx: ts.JsxEmit.Preserve,
    noEmit: true,
  };

  const program = ts.createProgram([absPath], compilerOptions);
  const sourceFile = program.getSourceFile(absPath);

  if (!sourceFile) {
    throw new Error(`TypeScript compiler could not parse: ${absPath}`);
  }

  let signatures = extractFunctions(sourceFile);

  // Filter to only exported or top-level functions (most useful for tests)
  signatures = signatures.filter((s) => s.exported || s.kind !== "method");

  // Drill-down: single function
  if (opts.functionName) {
    const match = signatures.find(
      (s) => s.name.toLowerCase() === opts.functionName!.toLowerCase()
    );
    if (!match) {
      throw new Error(
        `Function not found: "${opts.functionName}". Available: ${signatures
          .map((s) => s.name)
          .join(", ")}`
      );
    }
    signatures = [match];
  }

  const skeletons: FunctionTestSkeleton[] = signatures.map((sig) => {
    const cases = generateCases(sig, framework);
    return {
      functionName: sig.name,
      signature: sig,
      cases,
      importStatement: buildImportStatement([sig.name], absPath, framework),
    };
  });

  const totalCases = skeletons.reduce((s, sk) => s + sk.cases.length, 0);

  const prelim: TestGenDigest = {
    sourceFile: path.relative(process.cwd(), absPath),
    framework,
    skeletons,
    stats: {
      tokenEstimate: 0,
      rawEstimate: 0,
      savedPercent: 0,
      totalFunctions: skeletons.length,
      totalCases,
    },
    generatedAt: new Date().toISOString(),
  };

  const stats = computeStats(
    JSON.stringify(prelim),
    rawSize,
    skeletons.length,
    totalCases
  );

  let digest: TestGenDigest = { ...prelim, stats };

  if (opts.maxTokens) {
    digest = trimToTokenBudget(digest, opts.maxTokens);
    const trimmedStats = computeStats(
      JSON.stringify(digest),
      rawSize,
      digest.skeletons.length,
      digest.skeletons.reduce((s, sk) => s + sk.cases.length, 0)
    );
    digest = { ...digest, stats: trimmedStats };
  }

  return digest;
}
