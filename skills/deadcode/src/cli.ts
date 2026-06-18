#!/usr/bin/env node
/**
 * deadcode CLI
 *
 * Usage:
 *   deadcode [path] [--json|--md|--text] [--stats] [--limit N]
 *   deadcode --version
 *   deadcode --help
 */

import { parseArgs } from "node:util";
import { createRequire } from "node:module";
import { getDeadCode } from "./lib/digest.js";
import { formatJson, formatMarkdown, formatText } from "./lib/format/index.js";
import { DeadCodeOptions } from "./lib/types.js";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const pkg = require("../package.json") as { version: string; name: string };

const HELP = `
deadcode v${pkg.version} — token-efficient dead-export digest for AI agents

USAGE
  deadcode [path] [options]

ARGUMENTS
  path    Path to a TypeScript/JavaScript project directory (default: current directory)

OPTIONS
  --json            Output as compact JSON (agent-friendly)
  --md              Output as human-readable Markdown
  --text            Output as plain text (default)
  --stats           Print only the token-savings and dead-export summary line
  --limit N         Return only the first N dead-export entries (across all files)
  --max-depth N     Maximum directory traversal depth
  -h, --help        Show this help message
  --version         Show version

EXAMPLES
  deadcode .
  deadcode ./my-project --md
  deadcode . --stats
  deadcode . --limit 50 --json | some-agent-cli
  deadcode . --text --limit 20

NOTES
  - Uses the TypeScript compiler API to resolve imports and exports.
  - An export is dead if its name is never imported by any local file.
  - Namespace imports (import * as x) mark the source file as fully consumed.
  - Default exports of index.* files are never flagged (entry-point heuristic).
  - Re-exports (export { x } from './y') are tracked: names piped through a
    barrel are considered consumed only if the barrel's re-export is itself
    consumed by some other file.
`.trim();

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      json: { type: "boolean" },
      md: { type: "boolean" },
      text: { type: "boolean" },
      stats: { type: "boolean" },
      limit: { type: "string" },
      "max-depth": { type: "string" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean" },
    },
    allowPositionals: true,
    strict: false,
  });

  if (values["version"]) {
    process.stdout.write(`deadcode ${pkg.version}\n`);
    process.exit(0);
  }

  if (values["help"]) {
    process.stdout.write(HELP + "\n");
    process.exit(0);
  }

  let format: DeadCodeOptions["format"] = "text";
  if (values["json"]) format = "json";
  else if (values["md"]) format = "md";
  else if (values["text"]) format = "text";

  const limitRaw =
    typeof values["limit"] === "string" ? values["limit"] : undefined;
  const limit = limitRaw ? parseInt(limitRaw, 10) : undefined;
  if (limitRaw && (isNaN(limit!) || limit! <= 0)) {
    process.stderr.write(
      `Error: --limit must be a positive integer, got "${limitRaw}"\n`
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

  const rootPath = positionals[0] ?? ".";
  const opts: DeadCodeOptions = { format, limit, maxDepth };

  try {
    process.stderr.write(`Scanning for dead exports in ${rootPath}...\n`);

    const digest = await getDeadCode(rootPath, opts);

    if (values["stats"]) {
      const { stats } = digest;
      process.stdout.write(
        `deadcode: digest ~${stats.tokenEstimate.toLocaleString()} tokens | ` +
          `raw ~${stats.rawEstimate.toLocaleString()} tokens | ` +
          `${stats.savedPercent}% smaller | ` +
          `${stats.totalFiles} files, ${stats.totalExports} exports, ` +
          `${stats.deadCount} dead (${stats.deadPercent}%)\n`
      );
      process.exit(0);
    }

    let output: string;
    switch (format) {
      case "md":
        output = formatMarkdown(digest);
        break;
      case "json":
        output = formatJson(digest);
        break;
      default:
        output = formatText(digest);
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
