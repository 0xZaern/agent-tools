import { CoverGapDigest, FileCoverage } from "../types.js";

function fmt(v: number | null, suffix = "%"): string {
  return v === null ? "n/a" : `${v}${suffix}`;
}

function riskBadge(score: number): string {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

function fileRow(f: FileCoverage): string {
  return (
    `| \`${f.path}\` | **${f.riskScore}** (${riskBadge(f.riskScore)}) | ` +
    `${fmt(f.lines)} | ${fmt(f.branches)} | ${fmt(f.functions)} | ` +
    `${f.uncoveredLines} / ${f.totalLines} | ${f.reason} |`
  );
}

export function formatMarkdown(digest: CoverGapDigest): string {
  const { files, stats } = digest;
  const lines: string[] = [];

  lines.push("# covergap");
  lines.push("");
  lines.push(
    `> digest ~${stats.tokenEstimate.toLocaleString()} tokens · raw ~${stats.rawEstimate.toLocaleString()} tokens · **${stats.savedPercent}% smaller**`
  );
  lines.push(
    `> ${stats.totalFiles} files · ${stats.undertested} under-tested · ${stats.uncovered} uncovered` +
      (stats.overallLinePct !== null ? ` · **${stats.overallLinePct}% overall line coverage**` : "")
  );
  lines.push(`> source: \`${digest.source}\` (${digest.sourceFormat})`);
  lines.push("");

  if (files.length === 0) {
    lines.push("_No under-tested files found._");
  } else {
    lines.push("| File | Risk | Lines | Branches | Functions | Uncovered / Total | Reason |");
    lines.push("|------|------|-------|----------|-----------|-------------------|--------|");
    for (const f of files) {
      lines.push(fileRow(f));
    }
  }

  lines.push("");
  lines.push(`_generated ${digest.generatedAt.slice(0, 19).replace("T", " ")} UTC_`);

  return lines.join("\n");
}
