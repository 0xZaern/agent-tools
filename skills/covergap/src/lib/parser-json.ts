// Istanbul/nyc/c8/vitest coverage-final.json parser
// root object is keyed by absolute file path; each value has s/b/f maps + statementMap/branchMap/fnMap
// line coverage derived from statementMap when the "l" map is absent

import { RawFileCov } from "./types-internal.js";

interface StmtMap {
  [key: string]: { start: { line: number }; end: { line: number } };
}

interface IsFileCov {
  s?: Record<string, number>;
  b?: Record<string, number[]>;
  f?: Record<string, number>;
  statementMap?: StmtMap;
  l?: Record<string, number>;
  [key: string]: unknown;
}

type IsJson = Record<string, IsFileCov>;

export function parseIstanbulJson(content: string): RawFileCov[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("coverage-final.json is not valid JSON");
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(
      "coverage-final.json root must be an object keyed by file path"
    );
  }

  const json = parsed as IsJson;
  const results: RawFileCov[] = [];

  for (const [filePath, fc] of Object.entries(json)) {
    if (typeof fc !== "object" || fc === null) continue;

    // statements
    const stmts = fc.s ?? {};
    const stmtTotal = Object.keys(stmts).length;
    const stmtHit = Object.values(stmts).filter((v) => v > 0).length;

    // branches: each entry is an array of hit counts per branch arm
    const branches = fc.b ?? {};
    let brTotal = 0;
    let brHit = 0;
    for (const arms of Object.values(branches)) {
      if (Array.isArray(arms)) {
        brTotal += arms.length;
        brHit += arms.filter((v) => v > 0).length;
      }
    }

    // functions
    const fns = fc.f ?? {};
    const fnTotal = Object.keys(fns).length;
    const fnHit = Object.values(fns).filter((v) => v > 0).length;

    // lines - use the "l" map if available, otherwise derive from statementMap
    let linesFound = 0;
    let linesHit = 0;
    const uncoveredLineNumbers: number[] = [];

    if (fc.l && typeof fc.l === "object") {
      const lineMap = fc.l as Record<string, number>;
      for (const [, hits] of Object.entries(lineMap)) {
        linesFound++;
        if (hits > 0) linesHit++;
      }
      if (fc.statementMap && fc.s) {
        const seen = new Set<number>();
        for (const [k, stmt] of Object.entries(fc.statementMap)) {
          const hits = stmts[k] ?? 0;
          const lineNum = stmt.start.line;
          if (hits === 0 && !seen.has(lineNum)) {
            seen.add(lineNum);
            uncoveredLineNumbers.push(lineNum);
          }
        }
      }
    } else if (fc.statementMap && fc.s) {
      // group by line number
      const lineHits = new Map<number, number>();
      for (const [k, stmt] of Object.entries(fc.statementMap)) {
        const lineNum = stmt.start.line;
        const hits = stmts[k] ?? 0;
        lineHits.set(lineNum, (lineHits.get(lineNum) ?? 0) + hits);
      }
      for (const [lineNum, hits] of lineHits) {
        linesFound++;
        if (hits > 0) {
          linesHit++;
        } else {
          uncoveredLineNumbers.push(lineNum);
        }
      }
    } else {
      // fallback: treat statements as a line proxy
      linesFound = stmtTotal;
      linesHit = stmtHit;
    }

    results.push({
      path: filePath,
      linesFound,
      linesHit,
      branchesFound: brTotal,
      branchesHit: brHit,
      functionsFound: fnTotal,
      functionsHit: fnHit,
      uncoveredLineNumbers: uncoveredLineNumbers.sort((a, b) => a - b),
    });
  }

  return results;
}
