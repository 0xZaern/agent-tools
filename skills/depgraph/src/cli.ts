#!/usr/bin/env node
/**
 * depgraph CLI
 *
 * Usage:
 *   depgraph [path] [--json|--md|--text] [--stats] [--file path] [--max-tokens N]
 *   depgraph --version
 *   depgraph --help
 */

import { parseArgs } from "node:util";
import { createRequire } from "node:module";
import { getDepGraph } from "./lib/digest.js";
import { formatJson, formatMarkdown, formatText } from "./lib/format/index.js";
import { DepGraphOptions } from "./lib/types.js";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const pkg = require("../package.json") as { version: string; name: string };

const HELP = `
depgraph v${pkg.version} — token-efficient dependency graph digest for AI agents

USAGE
  depgraph [path] [options]

ARGUMENTS
  path    Path to a TypeScript/JavaScript project directory (default: current directory)

OPTIONS
  --json            Output as compact JSON (default, agent-friendly)
  --md              Output as human-readable Markdown
  --text            Output as plain text
  --stats           Print only the token-savings summary line
  --file path       Drill into a specific file — show its full import/export list
  --max-tokens N    Trim the digest to approximately N tokens
  --max-depth N     Maximum directory traversal depth
  -h, --help        Show this help message
  --version         Show version

EXAMPLES
  depgraph .
  depgraph ./my-project --md
  depgraph . --stats
  depgraph . --file src/services/auth.ts
  depgraph . --max-tokens 3000 --json | some-agent-cli

NOTES
  - Uses the TypeScript compiler API to resolve imports.
  - Detects circular dependencies via DFS.
  - Entry points: files not imported by any other file in the project.
  - Heaviest subtrees: files imported by the most other files.
`.trim();

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      json: { type: "boolean" },
      md: { type: "boolean" },
      text: { type: "boolean" },
      stats: { type: "boolean" },
      file: { type: "string" },
      "max-tokens": { type: "string" },
      "max-depth": { type: "string" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean" },
    },
    allowPositionals: true,
    strict: false,
  });

  if (values["version"]) {
    process.stdout.write(`depgraph ${pkg.version}\n`);
    process.exit(0);
  }

  if (values["help"]) {
    process.stdout.write(HELP + "\n");
    process.exit(0);
  }

  let format: DepGraphOptions["format"] = "json";
  if (values["md"]) format = "md";
  else if (values["text"]) format = "text";
  else if (values["json"]) format = "json";

  const maxTokensRaw =
    typeof values["max-tokens"] === "string" ? values["max-tokens"] : undefined;
  const maxTokens = maxTokensRaw ? parseInt(maxTokensRaw, 10) : undefined;
  if (maxTokensRaw && (isNaN(maxTokens!) || maxTokens! <= 0)) {
    process.stderr.write(
      `Error: --max-tokens must be a positive integer, got "${maxTokensRaw}"\n`
    );
    process.exit(1);
  }

  const maxDepthRaw =
    typeof values["max-depth"] === "string" ? values["max-depth"] : undefined;
  const maxDepth = maxDepthRaw ? parseInt(maxDepthRaw, 10) : undefined;
  if (maxDepthRaw && (isNaN(maxDepth!) || maxDepth! < 0)) {
    process.stderr.write(
      `Error: --max-depth must be a non-negative integer, got "${maxDepthRaw}"\n`
    );
    process.exit(1);
  }

  const drillFile =
    typeof values["file"] === "string" ? values["file"] : undefined;

  const rootPath = positionals[0] ?? ".";

  const opts: DepGraphOptions = { format, maxTokens, file: drillFile, maxDepth };

  try {
    process.stderr.write(`Mapping dependency graph for ${rootPath}...\n`);

    const digest = await getDepGraph(rootPath, opts);

    if (values["stats"]) {
      const { stats } = digest;
      process.stdout.write(
        `depgraph: digest ~${stats.tokenEstimate.toLocaleString()} tokens | ` +
          `raw ~${stats.rawEstimate.toLocaleString()} tokens | ` +
          `${stats.savedPercent}% smaller | ` +
          `${stats.totalFiles} files, ${stats.totalEdges} edges, ${stats.cycleCount} cycles\n`
      );
      process.exit(0);
    }

    let output: string;
    switch (format) {
      case "md":
        output = formatMarkdown(digest);
        break;
      case "text":
        output = formatText(digest);
        break;
      default:
        output = formatJson(digest);
    }

    process.stdout.write(output + "\n");
    process.exit(0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Fatal: ${message}\n`);
  process.exit(1);
});
