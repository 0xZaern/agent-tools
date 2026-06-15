import { ReleaseEntry, ReleaseMapDigest } from "../types.js";

function releaseBlock(r: ReleaseEntry): string[] {
  const lines: string[] = [];
  const breaking = r.breaking ? " [BREAKING]" : "";
  const date = r.date ? ` (${r.date})` : "";
  lines.push(`v${r.version}${date}${breaking}`);
  if (r.summary) {
    lines.push(`  ${r.summary}`);
  }
  const counts: string[] = [];
  if (r.added > 0) counts.push(`+${r.added} added`);
  if (r.changed > 0) counts.push(`~${r.changed} changed`);
  if (r.fixed > 0) counts.push(`x${r.fixed} fixed`);
  if (r.removed > 0) counts.push(`-${r.removed} removed`);
  if (counts.length > 0) {
    lines.push(`  ${counts.join(" | ")}`);
  }
  if (r.body) {
    lines.push("");
    lines.push(r.body.slice(0, 2000));
  }
  return lines;
}

export function formatText(digest: ReleaseMapDigest): string {
  const { releases, stats } = digest;
  const lines: string[] = [];

  lines.push("RELEASEMAP");
  lines.push(`SOURCE: ${digest.source} | TARGET: ${digest.target}`);
  lines.push(
    `STATS: digest ~${stats.tokenEstimate} tokens | raw ~${stats.rawEstimate} tokens | ${stats.savedPercent}% smaller`
  );
  lines.push(
    `RELEASES: ${stats.totalReleases} | BREAKING: ${stats.breakingCount}`
  );
  lines.push("");

  for (const r of releases) {
    lines.push(...releaseBlock(r));
    lines.push("");
  }

  lines.push(`GENERATED: ${digest.generatedAt.slice(0, 19).replace("T", " ")} UTC`);

  return lines.join("\n");
}
