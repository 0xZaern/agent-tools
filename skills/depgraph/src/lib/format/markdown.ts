import { DepGraphDigest, FileNode } from "../types.js";

function nodeSection(n: FileNode): string[] {
  const lines: string[] = [];
  lines.push(`#### \`${n.path}\``);
  lines.push("");

  if (n.imports.length > 0) {
    lines.push(`**Imports:** ${n.imports.map((i) => `\`${i}\``).join(", ")}`);
  }
  if (n.importedBy.length > 0) {
    lines.push(`**Imported by:** ${n.importedBy.map((i) => `\`${i}\``).join(", ")}`);
  }
  if (n.exports.length > 0) {
    const exportStr = n.exports
      .map((e) => `\`${e.name}\` _(${e.kind})_`)
      .join(", ");
    lines.push(`**Exports:** ${exportStr}`);
  }

  lines.push("");
  return lines;
}

export function formatMarkdown(digest: DepGraphDigest): string {
  const { nodes, cycles, entryPoints, heaviestSubtrees, stats } = digest;
  const lines: string[] = [];

  lines.push("# depgraph");
  lines.push("");
  lines.push(
    `> digest ~${stats.tokenEstimate.toLocaleString()} tokens · raw ~${stats.rawEstimate.toLocaleString()} tokens · **${stats.savedPercent}% smaller**`
  );
  lines.push(
    `> ${stats.totalFiles} files · ${stats.totalEdges} edges · ${stats.cycleCount} cycle${stats.cycleCount !== 1 ? "s" : ""}`
  );
  lines.push(`> root: \`${digest.root}\``);
  lines.push("");

  if (entryPoints.length > 0) {
    lines.push("## Entry Points");
    lines.push("");
    lines.push("Files not imported by anything (likely top-level modules):");
    lines.push("");
    for (const ep of entryPoints) {
      lines.push(`- \`${ep}\``);
    }
    lines.push("");
  }

  if (cycles.length > 0) {
    lines.push("## Circular Dependencies");
    lines.push("");
    for (const c of cycles) {
      lines.push(`- ${c.files.map((f) => `\`${f}\``).join(" → ")}`);
    }
    lines.push("");
  }

  if (heaviestSubtrees.length > 0) {
    lines.push("## Most Imported Files");
    lines.push("");
    lines.push("| File | Imported by |");
    lines.push("|------|------------|");
    for (const h of heaviestSubtrees) {
      lines.push(`| \`${h.path}\` | ${h.importedByCount} |`);
    }
    lines.push("");
  }

  lines.push("## All Files");
  lines.push("");
  for (const n of nodes) {
    lines.push(...nodeSection(n));
  }

  lines.push("---");
  lines.push(`_generated ${digest.generatedAt.slice(0, 19).replace("T", " ")} UTC_`);

  return lines.join("\n");
}
