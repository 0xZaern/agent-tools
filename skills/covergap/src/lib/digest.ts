// orchestration: detect format -> parse -> score -> sort -> stats -> digest

import fs from "node:fs";
import path from "node:path";
import { parseLcov } from "./parser-lcov.js";
import { parseIstanbulJson } from "./parser-json.js";
import { scoreFile } from "./scorer.js";
import {
  CoverGapDigest,
  CoverGapOptions,
  CoverGapStats,
  FileCoverage,
} from "./types.js";

function detectFormat(
  filePath: string,
  content: string
): "lcov" | "istanbul-json" {
  const ext = path.extname(filePath).toLowerCase();
  const base = path.basename(filePath).toLowerCase();

  if (ext === ".json" || base === "coverage-final.json") {
    return "istanbul-json";
  }
  if (
    ext === ".info" ||
    base === "lcov.info" ||
    content.trimStart().startsWith("SF:")
  ) {
    return "lcov";
  }
  // last resort: try JSON parse
  try {
    JSON.parse(content);
    return "istanbul-json";
  } catch {
    return "lcov";
  }
}

function computeStats(
  files: FileCoverage[],
  totalFiles: number,
  tokenEstimate: number,
  rawEstimate: number
): CoverGapStats {
  const undertested = files.filter(
    (f) => f.lines !== null && f.lines < 80
  ).length;
  const uncovered = files.filter(
    (f) => f.lines === null || f.lines === 0
  ).length;

  // weighted average line coverage across all files
  let totalLinesFound = 0;
  let totalLinesHit = 0;
  for (const f of files) {
    totalLinesFound += f.totalLines;
    totalLinesHit += f.totalLines - f.uncoveredLines;
  }
  const overallLinePct =
    totalLinesFound > 0
      ? Math.round(((totalLinesHit / totalLinesFound) * 100) * 10) / 10
      : null;

  const savedPercent =
    rawEstimate > 0
      ? Math.max(0, Math.round((1 - tokenEstimate / rawEstimate) * 100))
      : 0;

  return {
    tokenEstimate,
    rawEstimate,
    savedPercent,
    totalFiles,
    undertested,
    uncovered,
    overallLinePct,
  };
}

export async function getCoverGap(
  sourcePath: string,
  opts: CoverGapOptions = {}
): Promise<CoverGapDigest> {
  const absSource = path.resolve(sourcePath);

  if (!fs.existsSync(absSource)) {
    throw new Error(`Coverage file not found: ${absSource}`);
  }

  const content = fs.readFileSync(absSource, "utf8");
  const rawEstimate = Math.ceil(content.length / 4);

  const fmt = detectFormat(absSource, content);

  const rawFiles =
    fmt === "lcov" ? parseLcov(content) : parseIstanbulJson(content);

  if (rawFiles.length === 0) {
    throw new Error(`No file coverage records found in: ${absSource}`);
  }

  let scored: FileCoverage[] = rawFiles.map(scoreFile);

  const minRisk = opts.minRisk ?? 0;
  if (minRisk > 0) {
    scored = scored.filter((f) => f.riskScore >= minRisk);
  }

  scored.sort(
    (a, b) => b.riskScore - a.riskScore || a.path.localeCompare(b.path)
  );

  const limited =
    opts.limit !== undefined ? scored.slice(0, opts.limit) : scored;

  const prelim: Omit<CoverGapDigest, "stats"> = {
    source: absSource,
    sourceFormat: fmt,
    files: limited,
    generatedAt: new Date().toISOString(),
  };
  const tokenEstimate = Math.ceil(JSON.stringify(prelim).length / 4);

  const stats = computeStats(
    scored, // use full set for stats, not the limited slice
    rawFiles.length,
    tokenEstimate,
    rawEstimate
  );

  return { ...prelim, stats };
}
