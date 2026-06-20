// risk scorer
// formula: base = (1 - linePct/100) * 70, size = min(uncoveredLines/200, 1) * 30
// files that are both large and poorly covered score highest

import { RawFileCov } from "./types-internal.js";
import { FileCoverage } from "./types.js";

function pct(hit: number, found: number): number | null {
  if (found === 0) return null;
  return Math.round((hit / found) * 100 * 10) / 10; // 1dp
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function scoreFile(raw: RawFileCov): FileCoverage {
  const linePct = pct(raw.linesHit, raw.linesFound);
  const branchPct = pct(raw.branchesHit, raw.branchesFound);
  const fnPct = pct(raw.functionsHit, raw.functionsFound);
  const stmtPct = null; // lcov doesn't give us statements directly; left for json path

  const uncoveredLines = raw.linesFound - raw.linesHit;
  const totalLines = raw.linesFound;

  const gap = linePct !== null ? 1 - linePct / 100 : 1;
  const base = gap * 70;
  const sizeBoost = Math.min(uncoveredLines / 200, 1) * 30;
  const riskScore = clamp(Math.round(base + sizeBoost), 0, 100);

  let reason: string;
  if (linePct === null || linePct === 0) {
    reason = "no line coverage data - file appears completely untested";
  } else if (linePct < 20) {
    reason = `only ${linePct}% line coverage - nearly all ${uncoveredLines} executable lines are untested`;
  } else if (fnPct !== null && fnPct < 50) {
    reason = `${fnPct}% function coverage - over half of all functions never called`;
  } else if (branchPct !== null && branchPct < 50) {
    reason = `${branchPct}% branch coverage - many conditional paths untested`;
  } else if (uncoveredLines > 100) {
    reason = `${linePct}% line coverage but ${uncoveredLines} absolute uncovered lines - large file with significant gaps`;
  } else {
    reason = `${linePct}% line coverage with ${uncoveredLines} uncovered lines`;
  }

  return {
    path: raw.path,
    statements: stmtPct,
    branches: branchPct,
    functions: fnPct,
    lines: linePct,
    uncoveredLines,
    totalLines,
    riskScore,
    reason,
  };
}
