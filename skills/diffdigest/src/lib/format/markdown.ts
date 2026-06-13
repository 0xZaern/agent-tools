import { DiffDigest, FileChange } from "../types.js";

const CHANGE_EMOJI: Record<string, string> = {
  add: "A",
  modify: "M",
  delete: "D",
  rename: "R",
};

function fileSection(f: FileChange): string[] {
  const lines: string[] = [];
  const flag = CHANGE_EMOJI[f.changeType] ?? "M";
  const rename = f.fromPath ? ` _(renamed from \`${f.fromPath}\`)_` : "";
  lines.push(`#### \`[${flag}]\` ${f.path}${rename}`);
  lines.push("");
  lines.push(
    `+${f.additions} / -${f.deletions} · net ${f.netLines >= 0 ? "+" : ""}${f.netLines} · ${f.hunkCount} hunk${f.hunkCount !== 1 ? "s" : ""}`
  );

  if (f.changedSymbols.length > 0) {
    lines.push("");
    lines.push(`**Changed symbols:** ${f.changedSymbols.map((s) => `\`${s}\``).join(", ")}`);
  }

  if (f.hunks.length > 0) {
    lines.push("");
    lines.push("**Hunks:**");
    for (const h of f.hunks) {
      lines.push(`- \`${h.header}\` (+${h.additions}/-${h.deletions})`);
    }
  }

  lines.push("");
  return lines;
}

export function formatMarkdown(digest: DiffDigest): string {
  const { summary, files, riskSignals, stats } = digest;
  const lines: string[] = [];

  lines.push("# diffdigest");
  lines.push("");
  lines.push(
    `> digest ~${stats.tokenEstimate.toLocaleString()} tokens · raw ~${stats.rawEstimate.toLocaleString()} tokens · **${stats.savedPercent}% smaller**`
  );
  lines.push(
    `> ${summary.totalFiles} files · +${summary.additions} / -${summary.deletions} · net ${summary.netLines >= 0 ? "+" : ""}${summary.netLines} lines · source: \`${digest.source}\``
  );
  lines.push("");

  // Risk signals
  const risks: string[] = [];
  if (riskSignals.missingTests) risks.push("missing tests");
  if (riskSignals.schemaTouched) risks.push("schema touched");
  if (riskSignals.authOrSecretPatterns) risks.push("auth/secret patterns");

  if (risks.length > 0) {
    lines.push(`> **Risk signals:** ${risks.join(", ")}`);
    lines.push("");
  }

  lines.push("## Files");
  lines.push("");

  for (const f of files) {
    lines.push(...fileSection(f));
  }

  // Risk detail
  if (
    riskSignals.triggerFiles.missingTests.length > 0 ||
    riskSignals.triggerFiles.schema.length > 0 ||
    riskSignals.triggerFiles.authOrSecret.length > 0
  ) {
    lines.push("## Risk Signal Details");
    lines.push("");

    if (riskSignals.triggerFiles.missingTests.length > 0) {
      lines.push(
        `**Missing tests** — logic files changed without a test file: ${riskSignals.triggerFiles.missingTests.map((f) => `\`${f}\``).join(", ")}`
      );
    }
    if (riskSignals.triggerFiles.schema.length > 0) {
      lines.push(
        `**Schema touched** — ${riskSignals.triggerFiles.schema.map((f) => `\`${f}\``).join(", ")}`
      );
    }
    if (riskSignals.triggerFiles.authOrSecret.length > 0) {
      lines.push(
        `**Auth/secret patterns** — added lines matched sensitive patterns in: ${riskSignals.triggerFiles.authOrSecret.map((f) => `\`${f}\``).join(", ")}`
      );
    }
    lines.push("");
  }

  lines.push("---");
  lines.push(`_generated ${digest.generatedAt.slice(0, 19).replace("T", " ")} UTC_`);

  return lines.join("\n");
}
