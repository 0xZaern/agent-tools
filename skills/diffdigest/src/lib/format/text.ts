import { DiffDigest, FileChange } from "../types.js";

function fileBlock(f: FileChange): string[] {
  const lines: string[] = [];
  const rename = f.fromPath ? ` <- ${f.fromPath}` : "";
  lines.push(`[${f.changeType.toUpperCase().slice(0, 1)}] ${f.path}${rename}`);
  lines.push(
    `    +${f.additions}/-${f.deletions} net${f.netLines >= 0 ? "+" : ""}${f.netLines} | ${f.hunkCount} hunks`
  );
  if (f.changedSymbols.length > 0) {
    lines.push(`    symbols: ${f.changedSymbols.join(", ")}`);
  }
  return lines;
}

export function formatText(digest: DiffDigest): string {
  const { summary, files, riskSignals, stats } = digest;
  const lines: string[] = [];

  lines.push("DIFFDIGEST");
  lines.push(
    `STATS: digest ~${stats.tokenEstimate} tokens | raw ~${stats.rawEstimate} tokens | ${stats.savedPercent}% smaller`
  );
  lines.push(
    `SUMMARY: ${summary.totalFiles} files | +${summary.additions}/-${summary.deletions} net${summary.netLines >= 0 ? "+" : ""}${summary.netLines} | source: ${digest.source}`
  );

  const risks: string[] = [];
  if (riskSignals.missingTests) risks.push("missing-tests");
  if (riskSignals.schemaTouched) risks.push("schema-touched");
  if (riskSignals.authOrSecretPatterns) risks.push("auth/secret-patterns");
  if (risks.length > 0) {
    lines.push(`RISK: ${risks.join(", ")}`);
  }

  lines.push("");

  for (const f of files) {
    lines.push(...fileBlock(f));
  }

  lines.push("");
  lines.push(`GENERATED: ${digest.generatedAt.slice(0, 19).replace("T", " ")} UTC`);

  return lines.join("\n");
}
