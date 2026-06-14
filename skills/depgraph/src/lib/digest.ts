/**
 * Top-level depgraph orchestration: walk files → parse imports/exports →
 * build adjacency → detect cycles → compute entry points + heaviest subtrees →
 * stats → return DepGraphDigest.
 */

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { walkProject } from "./walk.js";
import { extractImports, extractExports } from "./extract.js";
import { findCycles } from "./cycles.js";
import {
  DepGraphDigest,
  DepGraphOptions,
  DepGraphStats,
  FileNode,
} from "./types.js";

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

function computeStats(
  output: string,
  rawEstimate: number,
  totalFiles: number,
  totalEdges: number,
  cycleCount: number
): DepGraphStats {
  const tokenEstimate = Math.ceil(output.length / 4);
  const savedPercent = Math.max(0, Math.round((1 - tokenEstimate / rawEstimate) * 100));
  return {
    tokenEstimate,
    rawEstimate,
    savedPercent,
    totalFiles,
    totalEdges,
    cycleCount,
  };
}

// ---------------------------------------------------------------------------
// Token budget trimming
// ---------------------------------------------------------------------------

function trimToTokenBudget(digest: DepGraphDigest, maxTokens: number): DepGraphDigest {
  const estimate = () => Math.ceil(JSON.stringify(digest).length / 4);
  if (estimate() <= maxTokens) return digest;

  // First: drop exports from nodes
  digest = {
    ...digest,
    nodes: digest.nodes.map((n) => ({ ...n, exports: [] })),
  };
  if (estimate() <= maxTokens) return digest;

  // Then: drop importedBy lists
  digest = {
    ...digest,
    nodes: digest.nodes.map((n) => ({ ...n, importedBy: [] })),
  };
  if (estimate() <= maxTokens) return digest;

  // Then: truncate nodes
  const keep = Math.max(1, Math.floor((maxTokens / estimate()) * digest.nodes.length));
  digest = { ...digest, nodes: digest.nodes.slice(0, keep) };

  return digest;
}

// ---------------------------------------------------------------------------
// Drill-down: single file
// ---------------------------------------------------------------------------

function drillDown(digest: DepGraphDigest, filePath: string): DepGraphDigest {
  const lower = filePath.toLowerCase().replace(/\\/g, "/");
  const match = digest.nodes.find(
    (n) =>
      n.path.toLowerCase().replace(/\\/g, "/") === lower ||
      n.path.toLowerCase().replace(/\\/g, "/").endsWith(lower)
  );

  if (!match) {
    throw new Error(
      `File not found in graph: "${filePath}". Available: ${digest.nodes
        .slice(0, 10)
        .map((n) => n.path)
        .join(", ")}...`
    );
  }

  return { ...digest, nodes: [match] };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getDepGraph(
  rootPath: string,
  opts: DepGraphOptions = {}
): Promise<DepGraphDigest> {
  const absRoot = path.resolve(rootPath);

  if (!fs.existsSync(absRoot)) {
    throw new Error(`Directory not found: ${absRoot}`);
  }

  const allFiles = walkProject(absRoot, opts.maxDepth);

  if (allFiles.length === 0) {
    throw new Error(`No TypeScript/JavaScript files found in: ${absRoot}`);
  }

  // Parse all files with TypeScript compiler API
  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    allowJs: true,
    jsx: ts.JsxEmit.Preserve,
    noEmit: true,
  };

  const program = ts.createProgram(allFiles, compilerOptions);

  // Build edges
  const allEdges: Array<{ from: string; to: string }> = [];
  const fileExports: Map<string, ReturnType<typeof extractExports>> = new Map();

  for (const file of allFiles) {
    const sourceFile = program.getSourceFile(file);
    if (!sourceFile) continue;

    const relPath = path.relative(absRoot, file).replace(/\\/g, "/");
    const imports = extractImports(file, absRoot, sourceFile);
    const exports_ = extractExports(sourceFile);

    fileExports.set(relPath, exports_);

    for (const edge of imports) {
      if (edge.isLocal) {
        allEdges.push({ from: edge.from, to: edge.to.replace(/\\/g, "/") });
      }
    }
  }

  // Build adjacency list (for cycle detection)
  const adjacency = new Map<string, string[]>();
  const importedByMap = new Map<string, Set<string>>();

  for (const file of allFiles) {
    const relPath = path.relative(absRoot, file).replace(/\\/g, "/");
    if (!adjacency.has(relPath)) adjacency.set(relPath, []);
    if (!importedByMap.has(relPath)) importedByMap.set(relPath, new Set());
  }

  for (const { from, to } of allEdges) {
    const neighbors = adjacency.get(from) ?? [];
    if (!neighbors.includes(to)) neighbors.push(to);
    adjacency.set(from, neighbors);

    const importers = importedByMap.get(to) ?? new Set();
    importers.add(from);
    importedByMap.set(to, importers);
  }

  // Detect cycles
  const cycles = findCycles(adjacency);

  // Build file nodes
  const nodes: FileNode[] = [];
  for (const file of allFiles) {
    const relPath = path.relative(absRoot, file).replace(/\\/g, "/");
    const imports_ = (adjacency.get(relPath) ?? []).filter((t) =>
      allFiles.some((f) => path.relative(absRoot, f).replace(/\\/g, "/") === t)
    );
    const importedBy = Array.from(importedByMap.get(relPath) ?? []);

    nodes.push({
      path: relPath,
      imports: imports_,
      importedBy,
      importedByCount: importedBy.length,
      exports: fileExports.get(relPath) ?? [],
    });
  }

  // Sort nodes by path for stable output
  nodes.sort((a, b) => a.path.localeCompare(b.path));

  // Entry points: files not imported by any other file
  const entryPoints = nodes
    .filter((n) => n.importedByCount === 0 && n.imports.length > 0)
    .map((n) => n.path);

  // Heaviest subtrees: top 10 most-imported files
  const heaviestSubtrees = nodes
    .filter((n) => n.importedByCount > 0)
    .sort((a, b) => b.importedByCount - a.importedByCount)
    .slice(0, 10)
    .map((n) => ({ path: n.path, importedByCount: n.importedByCount }));

  // Estimate raw token cost: 4 chars per token, approx file list size
  const rawEstimate = Math.ceil(
    allFiles.reduce((sum, f) => sum + fs.statSync(f).size, 0) / 4
  );

  const prelim: DepGraphDigest = {
    root: absRoot,
    nodes,
    cycles,
    entryPoints,
    heaviestSubtrees,
    stats: {
      tokenEstimate: 0,
      rawEstimate,
      savedPercent: 0,
      totalFiles: nodes.length,
      totalEdges: allEdges.length,
      cycleCount: cycles.length,
    },
    generatedAt: new Date().toISOString(),
  };

  const stats = computeStats(
    JSON.stringify(prelim),
    rawEstimate,
    nodes.length,
    allEdges.length,
    cycles.length
  );

  let digest: DepGraphDigest = { ...prelim, stats };

  // Drill-down
  if (opts.file) {
    digest = drillDown(digest, opts.file);
  }

  if (opts.maxTokens) {
    digest = trimToTokenBudget(digest, opts.maxTokens);
    const trimmedStats = computeStats(
      JSON.stringify(digest),
      rawEstimate,
      digest.nodes.length,
      allEdges.length,
      cycles.length
    );
    digest = { ...digest, stats: trimmedStats };
  }

  return digest;
}
