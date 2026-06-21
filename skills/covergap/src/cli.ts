#!/usr/bin/env node

import { parseArgs } from "node:util";
import { createRequire } from "node:module";
import { getCoverGap } from "./lib/digest.js";
import { formatJson, formatMarkdown, formatText } from "./lib/format/index.js";
import { CoverGapOptions } from "./lib/types.js";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const pkg = require("../package.json") as { version: string; name: string };

const HELP = `
covergap v${pkg.version} - coverage-gap digest for AI agents

USAGE
  covergap <coverage-file> [options]

ARGUMENTS
  coverage-file   Path to lcov.info OR coverage-final.json (Istanbul/nyc/c8/vitest).
                  Format is auto-detected from extension and content.

OPTIONS
  --json            Output as compact JSON (agent-friendly)
  --md              Output as Markdown table
  --text            Output as plain text (default)
  --stats           Print only the summary line
  --limit N         Return only the top N highest-risk files
  --min-risk N      Omit files with a risk score below N (0-100, default: 0)
  -h, --help        Show this help message
  --version         Show version

EXAMPLES
  covergap coverage/lcov.info
  covergap coverage/coverage-final.json --md
  covergap coverage/lcov.info --stats
  covergap coverage/lcov.info --limit 10 --json | some-agent-cli
  covergap coverage/coverage-final.json --min-risk 50 --text

NOTES
  - lcov.info:           produced by lcov, genhtml, Istanbul --reporter=lcov,
                         nyc --reporter=lcov, c8 --reporter=lcov, vitest --coverage.
  - coverage-final.json: produced by Istanbul v8 / nyc / c8 / vitest
                         (@vitest/coverage-istanbul or @vitest/coverage-v8).
  - Risk score (0-100) combines coverage gap % (70%) with absolute
    uncovered line count (30%) so large poorly-covered files score highest.
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
      "min-risk": { type: "string" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean" },
    },
    allowPositionals: true,
    strict: false,
  });

  if (values["version"]) {
    process.stdout.write(`covergap ${pkg.version}\n`);
    process.exit(0);
  }

  if (values["help"]) {
    process.stdout.write(HELP + "\n");
    process.exit(0);
  }

  let format: CoverGapOptions["format"] = "text";
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

  const minRiskRaw =
    typeof values["min-risk"] === "string" ? values["min-risk"] : undefined;
  const minRisk = minRiskRaw ? parseInt(minRiskRaw, 10) : undefined;
  if (minRiskRaw && (isNaN(minRisk!) || minRisk! < 0 || minRisk! > 100)) {
    process.stderr.write(
      `Error: --min-risk must be an integer between 0 and 100, got "${minRiskRaw}"\n`
    );
    process.exit(1);
  }

  const sourcePath = positionals[0];
  if (!sourcePath) {
    process.stderr.write("Error: coverage file path is required.\n\n");
    process.stdout.write(HELP + "\n");
    process.exit(1);
  }

  const opts: CoverGapOptions = { format, limit, minRisk };

  try {
    process.stderr.write(`Parsing coverage file: ${sourcePath}\n`);

    const digest = await getCoverGap(sourcePath, opts);

    if (values["stats"]) {
      const { stats } = digest;
      process.stdout.write(
        `covergap: digest ~${stats.tokenEstimate.toLocaleString()} tokens | ` +
          `raw ~${stats.rawEstimate.toLocaleString()} tokens | ` +
          `${stats.savedPercent}% smaller | ` +
          `${stats.totalFiles} files, ${stats.undertested} under-tested, ` +
          `${stats.uncovered} uncovered` +
          (stats.overallLinePct !== null
            ? ` | ${stats.overallLinePct}% overall line coverage`
            : "") +
          `\n`
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
