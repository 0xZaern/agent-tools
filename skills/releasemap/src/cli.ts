#!/usr/bin/env node
/**
 * releasemap CLI
 *
 * Usage:
 *   releasemap <target> [--json|--md|--text] [--stats] [--since v1.2.0] [--version v2.0.0]
 *   releasemap --version
 *   releasemap --help
 *
 * <target> can be:
 *   - A local CHANGELOG.md file path
 *   - A GitHub owner/repo slug (e.g. facebook/react)
 *   - An npm package name (e.g. react or @scope/package)
 */

import { parseArgs } from "node:util";
import { createRequire } from "node:module";
import { getReleaseMap } from "./lib/digest.js";
import { formatJson, formatMarkdown, formatText } from "./lib/format/index.js";
import { ReleaseMapOptions } from "./lib/types.js";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const pkg = require("../package.json") as { version: string; name: string };

const HELP = `
releasemap v${pkg.version} — token-efficient changelog/release digest for AI agents

USAGE
  releasemap <target> [options]

ARGUMENTS
  target    One of:
              ./CHANGELOG.md          — local changelog file
              owner/repo              — GitHub repo (uses GitHub Releases API)
              package-name            — npm package (uses npm registry)

OPTIONS
  --json            Output as compact JSON (default, agent-friendly)
  --md              Output as human-readable Markdown
  --text            Output as plain text
  --stats           Print only the token-savings summary line
  --since v1.2.0    Show only releases at or after this version
  --version v2.0.0  Drill into a single version (returns full release notes)
  --max-tokens N    Trim the digest to approximately N tokens
  --token ghp_...   GitHub personal access token (for higher rate limits)
  -h, --help        Show this help message
  --version         Show version (without argument)

EXAMPLES
  releasemap ./CHANGELOG.md
  releasemap ./CHANGELOG.md --since 2.0.0
  releasemap facebook/react
  releasemap facebook/react --version v18.0.0
  releasemap react --md
  releasemap next --stats
  releasemap ./CHANGELOG.md --max-tokens 2000 --json | some-agent-cli
`.trim();

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      json: { type: "boolean" },
      md: { type: "boolean" },
      text: { type: "boolean" },
      stats: { type: "boolean" },
      since: { type: "string" },
      version: { type: "string" },
      "max-tokens": { type: "string" },
      token: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
    strict: false,
  });

  // --version as a flag without positional prints CLI version
  if (
    values["version"] === undefined &&
    process.argv.includes("--version") &&
    positionals.length === 0
  ) {
    process.stdout.write(`releasemap ${pkg.version}\n`);
    process.exit(0);
  }

  if (values["help"]) {
    process.stdout.write(HELP + "\n");
    process.exit(0);
  }

  const target = positionals[0];
  if (!target) {
    process.stderr.write("Error: <target> is required. Run releasemap --help for usage.\n");
    process.exit(1);
  }

  let format: ReleaseMapOptions["format"] = "json";
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

  const since = typeof values["since"] === "string" ? values["since"] : undefined;
  const versionDrill =
    typeof values["version"] === "string" ? values["version"] : undefined;
  const token =
    typeof values["token"] === "string"
      ? values["token"]
      : process.env["GITHUB_TOKEN"];

  const opts: ReleaseMapOptions = { format, maxTokens, since, version: versionDrill, token };

  try {
    process.stderr.write(`Loading releases from ${target}...\n`);

    const digest = await getReleaseMap(target, opts);

    if (values["stats"]) {
      const { stats } = digest;
      process.stdout.write(
        `releasemap [${digest.source}]: digest ~${stats.tokenEstimate.toLocaleString()} tokens | ` +
          `raw ~${stats.rawEstimate.toLocaleString()} tokens | ` +
          `${stats.savedPercent}% smaller | ` +
          `${stats.totalReleases} releases, ${stats.breakingCount} breaking\n`
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
