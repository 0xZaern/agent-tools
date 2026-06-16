#!/usr/bin/env node
/**
 * testgen CLI
 *
 * Usage:
 *   testgen <file> [--json|--md|--text] [--stats] [--framework vitest|jest] [--function name]
 *   testgen --version
 *   testgen --help
 */

import { parseArgs } from "node:util";
import { createRequire } from "node:module";
import { getTestGen } from "./lib/digest.js";
import { formatJson, formatMarkdown, formatText } from "./lib/format/index.js";
import { TestGenOptions, TestFramework } from "./lib/types.js";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const pkg = require("../package.json") as { version: string; name: string };

const HELP = `
testgen v${pkg.version} — edge-case test skeleton generator for AI agents

USAGE
  testgen <file> [options]

ARGUMENTS
  file    Path to a TypeScript or JavaScript source file

OPTIONS
  --json              Output as compact JSON (default, agent-friendly)
  --md                Output as human-readable Markdown
  --text              Output as a ready-to-paste test file
  --stats             Print only the token-savings summary line
  --framework vitest  Test framework to target (default: vitest)
  --framework jest    Generate jest-compatible test stubs
  --function name     Drill into a single function by name
  --max-tokens N      Trim the digest to approximately N tokens
  -h, --help          Show this help message
  --version           Show version

EXAMPLES
  testgen ./src/utils/validate.ts
  testgen ./src/utils/validate.ts --text > validate.test.ts
  testgen ./src/services/auth.ts --function verifyToken
  testgen ./src/lib/math.ts --framework jest --md
  testgen ./src/api.ts --max-tokens 2000 --json | some-agent-cli

GENERATED CASES PER FUNCTION
  - happy-path: valid inputs, expects a defined result
  - null: each required param passed as null
  - undefined: all params passed as undefined
  - empty: string params = "", array params = []
  - boundary: number params at 0, -1, Number.MAX_SAFE_INTEGER; strings at 10k chars
  - type-mismatch: each required param passed the wrong type

NOTES
  - Only exported functions and public class methods are included.
  - Uses the TypeScript compiler API — works on .ts, .tsx, .js, .jsx files.
  - Generated cases are stubs: fill in expected values before running.
`.trim();

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      json: { type: "boolean" },
      md: { type: "boolean" },
      text: { type: "boolean" },
      stats: { type: "boolean" },
      framework: { type: "string" },
      function: { type: "string" },
      "max-tokens": { type: "string" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean" },
    },
    allowPositionals: true,
    strict: false,
  });

  if (values["version"]) {
    process.stdout.write(`testgen ${pkg.version}\n`);
    process.exit(0);
  }

  if (values["help"]) {
    process.stdout.write(HELP + "\n");
    process.exit(0);
  }

  const sourceFile = positionals[0];
  if (!sourceFile) {
    process.stderr.write("Error: <file> is required. Run testgen --help for usage.\n");
    process.exit(1);
  }

  let format: TestGenOptions["format"] = "json";
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

  const frameworkRaw =
    typeof values["framework"] === "string" ? values["framework"] : "vitest";
  if (frameworkRaw !== "vitest" && frameworkRaw !== "jest") {
    process.stderr.write(
      `Error: --framework must be "vitest" or "jest", got "${frameworkRaw}"\n`
    );
    process.exit(1);
  }
  const framework = frameworkRaw as TestFramework;

  const functionNameRaw =
    typeof values["function"] === "string" ? values["function"] : undefined;
  if (functionNameRaw !== undefined && functionNameRaw.trim() === "") {
    process.stderr.write(
      `Error: --function value must not be empty. Pass a function name or omit the flag.\n`
    );
    process.exit(1);
  }
  const functionName = functionNameRaw?.trim();

  const opts: TestGenOptions = { format, maxTokens, framework, functionName };

  try {
    process.stderr.write(`Generating test skeletons for ${sourceFile}...\n`);

    const digest = await getTestGen(sourceFile, opts);

    if (values["stats"]) {
      const { stats } = digest;
      process.stdout.write(
        `testgen [${digest.framework}]: digest ~${stats.tokenEstimate.toLocaleString()} tokens | ` +
          `raw ~${stats.rawEstimate.toLocaleString()} tokens | ` +
          `${stats.savedPercent}% smaller | ` +
          `${stats.totalFunctions} functions, ${stats.totalCases} cases\n`
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
