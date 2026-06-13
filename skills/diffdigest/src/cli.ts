#!/usr/bin/env node
/**
 * diffdigest CLI
 *
 * Usage:
 *   diffdigest [source] [--json|--md|--text] [--stats] [--file path] [--max-tokens N]
 *   git diff | diffdigest [--json|--md|--text] [--stats]
 *   diffdigest https://github.com/owner/repo/pull/123
 *   diffdigest --version
 *   diffdigest --help
 */

import { parseArgs } from "node:util";
import { createRequire } from "node:module";
import { getDiffDigest } from "./lib/digest.js";
import { formatJson, formatMarkdown, formatText } from "./lib/format/index.js";
import { DiffDigestOptions } from "./lib/types.js";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const pkg = require("../package.json") as { version: string; name: string };

const HELP = `
diffdigest v${pkg.version} — token-efficient git diff / PR digest for AI agents

USAGE
  diffdigest [source] [options]
  git diff | diffdigest [options]

ARGUMENTS
  source    Path to a .diff/.patch file, a GitHub PR URL
            (https://github.com/owner/repo/pull/N), or "-" to read stdin

OPTIONS
  --json            Output as compact JSON (default, agent-friendly)
  --md              Output as human-readable Markdown
  --text            Output as plain text
  --stats           Print only the token-savings summary line
  --file path       Drill into a specific file path within the diff
  --max-tokens N    Trim the digest to approximately N tokens
  --token ghp_...   GitHub personal access token (for private repos)
  -h, --help        Show this help message
  --version         Show version

EXAMPLES
  git diff HEAD~1 | diffdigest
  diffdigest ./feature.diff --md
  diffdigest https://github.com/owner/repo/pull/42
  diffdigest ./big.diff --file src/auth/login.ts
  diffdigest ./big.diff --stats
  git diff | diffdigest --max-tokens 2000 --json | some-agent-cli

NOTES
  - Parses unified diff format (output of git diff, diff -u, etc.).
  - For GitHub PRs, uses the GitHub Compare API; set GITHUB_TOKEN env or --token.
  - Risk signals: missing tests, schema files touched, auth/secret patterns added.
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
      token: { type: "string" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean" },
    },
    allowPositionals: true,
    strict: false,
  });

  if (values["version"]) {
    process.stdout.write(`diffdigest ${pkg.version}\n`);
    process.exit(0);
  }

  if (values["help"]) {
    process.stdout.write(HELP + "\n");
    process.exit(0);
  }

  let format: DiffDigestOptions["format"] = "json";
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

  const drillFile =
    typeof values["file"] === "string" ? values["file"] : undefined;
  const token =
    typeof values["token"] === "string"
      ? values["token"]
      : process.env["GITHUB_TOKEN"];

  const source = positionals[0] ?? null;

  const opts: DiffDigestOptions = { format, maxTokens, file: drillFile, token };

  try {
    if (source) {
      process.stderr.write(`Reading diff from ${source}...\n`);
    } else {
      process.stderr.write("Reading from stdin...\n");
    }

    const digest = await getDiffDigest(source, opts);

    if (values["stats"]) {
      const { stats, summary } = digest;
      process.stdout.write(
        `diffdigest: digest ~${stats.tokenEstimate.toLocaleString()} tokens | ` +
          `raw ~${stats.rawEstimate.toLocaleString()} tokens | ` +
          `${stats.savedPercent}% smaller | ` +
          `${summary.totalFiles} files +${summary.additions}/-${summary.deletions}\n`
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
