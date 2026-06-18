import { DeadCodeDigest } from "../types.js";

export function formatText(digest: DeadCodeDigest): string {
  const { files, stats } = digest;
  const lines: string[] = [];

  lines.push("DEADCODE");
  lines.push(`ROOT: ${digest.root}`);
  lines.push(
    `STATS: digest ~${stats.tokenEstimate} tokens | raw ~${stats.rawEstimate} tokens | ${stats.savedPercent}% smaller`
  );
  lines.push(
    `FILES: ${stats.totalFiles} scanned | EXPORTS: ${stats.totalExports} total | DEAD: ${stats.deadCount} (${stats.deadPercent}%)`
  );
  lines.push("");

  if (files.length === 0) {
    lines.push("No dead exports found.");
  } else {
    for (const f of files) {
      lines.push(`${f.path}  (${f.exports.length} dead)`);
      for (const exp of f.exports) {
        lines.push(`  L${exp.line}  ${exp.kind}  ${exp.name}`);
      }
    }
  }

  lines.push("");
  lines.push(`GENERATED: ${digest.generatedAt.slice(0, 19).replace("T", " ")} UTC`);

  return lines.join("\n");
}
