/**
 * Top-level deadcode orchestration:
 *   walk files → parse exports + imports → compute consumption map →
 *   identify dead exports → sort → stats → return DeadCodeDigest.
 */

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { walkProject } from "./walk.js";
import { extractExports, extractImports } from "./extract.js";
import {
  DeadCodeDigest,
  DeadCodeOptions,
  DeadCodeStats,
  DeadExport,
  DeadFile,
} from "./types.js";

// ---------------------------------------------------------------------------
// Heuristics
// ---------------------------------------------------------------------------

/**
 * Returns true when this file is likely a package entry point (index.*).
 * Default exports from index files are never flagged because they are almost
 * always consumed by the external caller rather than by a local import.
 *
 * Heuristic: basename (without extension) equals "index".
 */
function isIndexFile(relPath: string): boolean {
  const base = path.basename(relPath, path.extname(relPath));
  return base === "index";
}

// ---------------------------------------------------------------------------
// Stats helpers
// ---------------------------------------------------------------------------

function computeStats(
  digestJson: string,
  rawEstimate: number,
  totalFiles: number,
  totalExports: number,
  deadCount: number
): DeadCodeStats {
  const tokenEstimate = Math.ceil(digestJson.length / 4);
  const savedPercent = rawEstimate > 0
    ? Math.max(0, Math.round((1 - tokenEstimate / rawEstimate) * 100))
    : 0;
  const deadPercent = totalExports > 0
    ? Math.round((deadCount / totalExports) * 100)
    : 0;
  return {
    tokenEstimate,
    rawEstimate,
    savedPercent,
    totalFiles,
    totalExports,
    deadCount,
    deadPercent,
  };
}

// ---------------------------------------------------------------------------
// Token budget trimming
// ---------------------------------------------------------------------------

function trimToLimit(files: DeadFile[], limit: number): DeadFile[] {
  let remaining = limit;
  const trimmed: DeadFile[] = [];
  for (const f of files) {
    if (remaining <= 0) break;
    const slice = f.exports.slice(0, remaining);
    trimmed.push({ ...f, exports: slice });
    remaining -= slice.length;
  }
  return trimmed;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getDeadCode(
  rootPath: string,
  opts: DeadCodeOptions = {}
): Promise<DeadCodeDigest> {
  const absRoot = path.resolve(rootPath);

  if (!fs.existsSync(absRoot)) {
    throw new Error(`Directory not found: ${absRoot}`);
  }

  const allFiles = walkProject(absRoot, opts.maxDepth);

  if (allFiles.length === 0) {
    throw new Error(`No TypeScript/JavaScript files found in: ${absRoot}`);
  }

  // Parse all files with the TypeScript compiler API (same approach as depgraph)
  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    allowJs: true,
    jsx: ts.JsxEmit.Preserve,
    noEmit: true,
  };

  const program = ts.createProgram(allFiles, compilerOptions);

  // Step 1: collect all exports per relative path
  // exportMap: relPath -> array of ExportRecord
  const exportMap = new Map<string, Array<{ name: string; kind: string; line: number }>>();

  // Step 2: collect all consumption records
  // consumedMap: relPath -> Set of consumed names (undefined entry means "all consumed")
  const consumedAllSet = new Set<string>(); // files whose every export is consumed
  const consumedNames = new Map<string, Set<string>>(); // relPath -> set of consumed names

  for (const file of allFiles) {
    const relPath = path.relative(absRoot, file).replace(/\\/g, "/");
    const sourceFile = program.getSourceFile(file);
    if (!sourceFile) continue;

    // Exports
    const exports_ = extractExports(sourceFile);
    exportMap.set(relPath, exports_);

    // Imports (what this file consumes from other locals)
    const imports_ = extractImports(file, absRoot, sourceFile);
    for (const imp of imports_) {
      const fromRel = imp.fromPath;
      if (imp.names === undefined) {
        // namespace import or dynamic — treat as consuming everything from that file
        consumedAllSet.add(fromRel);
      } else {
        if (!consumedNames.has(fromRel)) consumedNames.set(fromRel, new Set());
        const set = consumedNames.get(fromRel)!;
        for (const n of imp.names) set.add(n);
      }
    }
  }

  // Step 3: identify dead exports
  let totalExports = 0;
  let deadCount = 0;
  const deadFiles: DeadFile[] = [];

  for (const [relPath, exports_] of exportMap) {
    totalExports += exports_.length;

    // If this file is wholly namespace-imported, all its exports are consumed
    if (consumedAllSet.has(relPath)) {
      continue;
    }

    const consumed = consumedNames.get(relPath) ?? new Set<string>();
    const isIndex = isIndexFile(relPath);

    const dead: DeadExport[] = [];

    for (const exp of exports_) {
      // Heuristic: default export of index.* files — skip flagging
      // Rationale: package consumers typically import the default from index
      // but their import lives outside the scanned project tree.
      if (isIndex && exp.name === "default") {
        continue;
      }

      if (!consumed.has(exp.name)) {
        dead.push({
          name: exp.name,
          kind: exp.kind as DeadExport["kind"],
          line: exp.line,
        });
        deadCount++;
      }
    }

    if (dead.length > 0) {
      // Sort dead exports by line number within each file
      dead.sort((a, b) => a.line - b.line);
      deadFiles.push({ path: relPath, exports: dead });
    }
  }

  // Sort files by number of dead exports descending, then by path for stability
  deadFiles.sort((a, b) => b.exports.length - a.exports.length || a.path.localeCompare(b.path));

  // Apply limit
  const limitedFiles = opts.limit !== undefined ? trimToLimit(deadFiles, opts.limit) : deadFiles;

  // Estimate raw token cost: sum of file sizes / 4
  const rawEstimate = Math.ceil(
    allFiles.reduce((sum, f) => {
      try { return sum + fs.statSync(f).size; } catch { return sum; }
    }, 0) / 4
  );

  const prelim: DeadCodeDigest = {
    root: absRoot,
    files: limitedFiles,
    stats: {
      tokenEstimate: 0,
      rawEstimate,
      savedPercent: 0,
      totalFiles: allFiles.length,
      totalExports,
      deadCount,
      deadPercent: totalExports > 0 ? Math.round((deadCount / totalExports) * 100) : 0,
    },
    generatedAt: new Date().toISOString(),
  };

  const stats = computeStats(
    JSON.stringify(prelim),
    rawEstimate,
    allFiles.length,
    totalExports,
    deadCount
  );

  return { ...prelim, stats };
}
