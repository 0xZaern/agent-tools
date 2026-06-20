// lcov.info parser
// handles SF/DA/BRDA/FNF/FNH/LF/LH/BRF/BRH records

import { RawFileCov } from "./types-internal.js";

export function parseLcov(content: string): RawFileCov[] {
  const results: RawFileCov[] = [];
  let current: Partial<RawFileCov> | null = null;

  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    if (line.startsWith("SF:")) {
      current = {
        path: line.slice(3),
        linesFound: 0,
        linesHit: 0,
        branchesFound: 0,
        branchesHit: 0,
        functionsFound: 0,
        functionsHit: 0,
        uncoveredLineNumbers: [],
      };
      continue;
    }

    if (!current) continue;

    if (line.startsWith("LF:")) {
      current.linesFound = parseInt(line.slice(3), 10) || 0;
    } else if (line.startsWith("LH:")) {
      current.linesHit = parseInt(line.slice(3), 10) || 0;
    } else if (line.startsWith("BRF:")) {
      current.branchesFound = parseInt(line.slice(4), 10) || 0;
    } else if (line.startsWith("BRH:")) {
      current.branchesHit = parseInt(line.slice(4), 10) || 0;
    } else if (line.startsWith("FNF:")) {
      current.functionsFound = parseInt(line.slice(4), 10) || 0;
    } else if (line.startsWith("FNH:")) {
      current.functionsHit = parseInt(line.slice(4), 10) || 0;
    } else if (line.startsWith("DA:")) {
      // DA:<line>,<hits>[,<checksum>]
      const parts = line.slice(3).split(",");
      const hits = parseInt(parts[1] ?? "0", 10);
      if (hits === 0) {
        const lineNum = parseInt(parts[0] ?? "0", 10);
        if (lineNum > 0) current.uncoveredLineNumbers!.push(lineNum);
      }
    } else if (line === "end_of_record") {
      if (current && current.path) {
        results.push(current as RawFileCov);
      }
      current = null;
    }
  }

  // handle files without end_of_record (malformed but common)
  if (current && current.path) {
    results.push(current as RawFileCov);
  }

  return results;
}
