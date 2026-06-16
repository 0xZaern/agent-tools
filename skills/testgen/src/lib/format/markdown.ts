import { FunctionTestSkeleton, TestGenDigest } from "../types.js";

function skeletonSection(sk: FunctionTestSkeleton, idx: number): string[] {
  const lines: string[] = [];
  const sig = sk.signature;
  const params = sig.params
    .map((p) => `${p.name}: ${p.type}${p.optional ? "?" : ""}`)
    .join(", ");

  lines.push(`### ${idx + 1}. \`${sk.functionName}\``);
  lines.push("");
  lines.push(
    `**Signature:** \`${sig.async ? "async " : ""}${sig.kind} ${sk.functionName}(${params}): ${sig.returnType}\``
  );
  if (sig.jsdoc) {
    lines.push("");
    lines.push(`> ${sig.jsdoc.replace(/\n/g, "\n> ")}`);
  }
  lines.push("");
  lines.push(`**Import:** \`${sk.importStatement}\``);
  lines.push("");
  lines.push(`**Test cases (${sk.cases.length}):**`);
  lines.push("");

  for (const c of sk.cases) {
    lines.push(`#### \`${c.category}\`: ${c.description}`);
    lines.push("");
    lines.push("```ts");
    lines.push(c.body);
    lines.push("```");
    lines.push("");
  }

  return lines;
}

export function formatMarkdown(digest: TestGenDigest): string {
  const { skeletons, stats, framework } = digest;
  const lines: string[] = [];

  lines.push("# testgen");
  lines.push("");
  lines.push(
    `> digest ~${stats.tokenEstimate.toLocaleString()} tokens · raw ~${stats.rawEstimate.toLocaleString()} tokens · **${stats.savedPercent}% smaller**`
  );
  lines.push(
    `> ${stats.totalFunctions} function(s) · ${stats.totalCases} test cases · framework: \`${framework}\` · source: \`${digest.sourceFile}\``
  );
  lines.push("");

  if (skeletons.length === 0) {
    lines.push("_No exportable functions found in the source file._");
    lines.push("");
  } else {
    lines.push("## Test Skeletons");
    lines.push("");
    for (let i = 0; i < skeletons.length; i++) {
      lines.push(...skeletonSection(skeletons[i]!, i));
    }
  }

  lines.push("---");
  lines.push(`_generated ${digest.generatedAt.slice(0, 19).replace("T", " ")} UTC_`);

  return lines.join("\n");
}
