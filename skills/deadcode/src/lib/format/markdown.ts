import { DeadCodeDigest, DeadFile } from "../types.js";

function fileSection(f: DeadFile): string[] {
  const lines: string[] = [];
  lines.push(`#### \`${f.path}\``);
  lines.push("");
  lines.push("| Line | Kind | Name |");
  lines.push("|------|------|------|");
  for (const exp of f.exports) {
    lines.push(`| ${exp.line} | ${exp.kind} | \`${exp.name}\` |`);
  }
  lines.push("");
  return lines;
}

export function formatMarkdown(digest: DeadCodeDigest): string {
  const { files, stats } = digest;
  const lines: string[] = [];

  lines.push("# deadcode");
  lines.push("");
  lines.push(
    `> digest ~${stats.tokenEstimate.toLocaleString()} tokens · raw ~${stats.rawEstimate.toLocaleString()} tokens · **${stats.savedPercent}% smaller**`
  );
  lines.push(
    `> ${stats.totalFiles} files scanned · ${stats.totalExports} exports · **${stats.deadCount} dead (${stats.deadPercent}%)**`
  );
  lines.push(`> root: \`${digest.root}\``);
  lines.push("");

  if (files.length === 0) {
    lines.push("_No dead exports found._");
  } else {
    lines.push("## Dead Exports by File");
    lines.push("");
    lines.push("Files are ranked by number of dead exports (most first).");
    lines.push("");
    for (const f of files) {
      lines.push(...fileSection(f));
    }
  }

  lines.push("---");
  lines.push(`_generated ${digest.generatedAt.slice(0, 19).replace("T", " ")} UTC_`);

  return lines.join("\n");
}
