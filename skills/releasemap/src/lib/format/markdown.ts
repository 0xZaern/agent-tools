import { ReleaseEntry, ReleaseMapDigest } from "../types.js";

function releaseSection(r: ReleaseEntry, idx: number): string[] {
  const lines: string[] = [];
  const breaking = r.breaking ? " **[BREAKING]**" : "";
  const date = r.date ? ` — ${r.date}` : "";
  lines.push(`### ${idx + 1}. v${r.version}${date}${breaking}`);
  lines.push("");

  if (r.summary) {
    lines.push(r.summary);
    lines.push("");
  }

  const counts: string[] = [];
  if (r.added > 0) counts.push(`**+${r.added}** added`);
  if (r.changed > 0) counts.push(`**~${r.changed}** changed`);
  if (r.fixed > 0) counts.push(`**x${r.fixed}** fixed`);
  if (r.removed > 0) counts.push(`**-${r.removed}** removed`);
  if (counts.length > 0) {
    lines.push(counts.join(" · "));
    lines.push("");
  }

  if (r.body) {
    lines.push("<details><summary>Full release notes</summary>");
    lines.push("");
    lines.push(r.body.slice(0, 5000));
    lines.push("");
    lines.push("</details>");
    lines.push("");
  }

  return lines;
}

export function formatMarkdown(digest: ReleaseMapDigest): string {
  const { releases, stats } = digest;
  const lines: string[] = [];

  lines.push("# releasemap");
  lines.push("");
  lines.push(
    `> digest ~${stats.tokenEstimate.toLocaleString()} tokens · raw ~${stats.rawEstimate.toLocaleString()} tokens · **${stats.savedPercent}% smaller**`
  );
  lines.push(
    `> ${stats.totalReleases} releases · ${stats.breakingCount} breaking · source: \`${digest.source}\` · target: \`${digest.target}\``
  );
  lines.push("");

  if (releases.length === 0) {
    lines.push("_No releases found._");
    lines.push("");
  } else {
    lines.push("## Releases");
    lines.push("");
    for (let i = 0; i < releases.length; i++) {
      lines.push(...releaseSection(releases[i]!, i));
    }
  }

  lines.push("---");
  lines.push(`_generated ${digest.generatedAt.slice(0, 19).replace("T", " ")} UTC_`);

  return lines.join("\n");
}
