import { DepGraphDigest } from "../types.js";

export function formatText(digest: DepGraphDigest): string {
  const { nodes, cycles, entryPoints, heaviestSubtrees, stats } = digest;
  const lines: string[] = [];

  lines.push("DEPGRAPH");
  lines.push(`ROOT: ${digest.root}`);
  lines.push(
    `STATS: digest ~${stats.tokenEstimate} tokens | raw ~${stats.rawEstimate} tokens | ${stats.savedPercent}% smaller`
  );
  lines.push(
    `FILES: ${stats.totalFiles} | EDGES: ${stats.totalEdges} | CYCLES: ${stats.cycleCount}`
  );
  lines.push("");

  if (entryPoints.length > 0) {
    lines.push("ENTRY POINTS:");
    for (const ep of entryPoints) {
      lines.push(`  ${ep}`);
    }
    lines.push("");
  }

  if (cycles.length > 0) {
    lines.push("CYCLES:");
    for (const c of cycles) {
      lines.push(`  ${c.files.join(" -> ")}`);
    }
    lines.push("");
  }

  if (heaviestSubtrees.length > 0) {
    lines.push("MOST IMPORTED:");
    for (const h of heaviestSubtrees) {
      lines.push(`  ${h.path} (imported by ${h.importedByCount})`);
    }
    lines.push("");
  }

  lines.push("FILES:");
  for (const node of nodes) {
    lines.push(`  ${node.path}`);
    if (node.imports.length > 0) {
      lines.push(`    imports: ${node.imports.join(", ")}`);
    }
    if (node.exports.length > 0) {
      lines.push(`    exports: ${node.exports.map((e) => e.name).join(", ")}`);
    }
  }

  lines.push("");
  lines.push(`GENERATED: ${digest.generatedAt.slice(0, 19).replace("T", " ")} UTC`);

  return lines.join("\n");
}
