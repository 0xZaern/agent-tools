import { CoverGapDigest } from "../types.js";

function fmt(v: number | null, suffix = "%"): string {
  return v === null ? "n/a" : `${v}${suffix}`;
}

export function formatText(digest: CoverGapDigest): string {
  const { files, stats } = digest;
  const lines: string[] = [];

  lines.push("COVERGAP");
  lines.push(`SOURCE: ${digest.source}  [${digest.sourceFormat}]`);
  lines.push(
    `STATS: digest ~${stats.tokenEstimate} tokens | raw ~${stats.rawEstimate} tokens | ${stats.savedPercent}% smaller`
  );
  lines.push(
    `FILES: ${stats.totalFiles} total | ${stats.undertested} under-tested (<80% lines) | ${stats.uncovered} uncovered`
  );
  if (stats.overallLinePct !== null) {
    lines.push(`OVERALL LINE COV: ${stats.overallLinePct}%`);
  }
  lines.push("");

  if (files.length === 0) {
    lines.push("No under-tested files found.");
  } else {
    for (const f of files) {
      lines.push(
        `[risk ${f.riskScore}] ${f.path}  (${f.uncoveredLines}/${f.totalLines} lines uncovered)`
      );
      lines.push(
        `  lines: ${fmt(f.lines)}  branches: ${fmt(f.branches)}  functions: ${fmt(f.functions)}`
      );
      lines.push(`  ${f.reason}`);
    }
  }

  lines.push("");
  lines.push(`GENERATED: ${digest.generatedAt.slice(0, 19).replace("T", " ")} UTC`);

  return lines.join("\n");
}
