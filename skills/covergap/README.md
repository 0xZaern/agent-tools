# covergap

Hand an AI agent a compact coverage-gap digest instead of making it parse a raw lcov or Istanbul JSON report.

`covergap` reads a `lcov.info` or `coverage-final.json` file (produced by Istanbul, nyc, c8, or vitest), scores each file by risk (combining coverage gap with absolute uncovered line count), and returns a ranked list of the highest-priority files to write tests for next. A 5 MB lcov report becomes roughly 400 tokens.

## Install

```sh
npx covergap
```

Or as a library:

```sh
npm install covergap
```

## CLI Usage

```
covergap <coverage-file> [options]

ARGUMENTS
  coverage-file   Path to lcov.info OR coverage-final.json.
                  Format is auto-detected from extension and content.

OPTIONS
  --json            Output as compact JSON (agent-friendly)
  --md              Output as Markdown table
  --text            Output as plain text (default)
  --stats           Print only the summary line
  --limit N         Return only the top N highest-risk files
  --min-risk N      Omit files with a risk score below N (0-100, default: 0)
  -h, --help        Show help
  --version         Show version
```

### Examples

```sh
# Plain text report from lcov output
covergap coverage/lcov.info

# Markdown table - paste directly into a PR comment
covergap coverage/lcov.info --md

# Just the summary line
covergap coverage/coverage-final.json --stats

# Top 10 riskiest files as JSON - pipe to an agent
covergap coverage/lcov.info --limit 10 --json | some-agent-cli

# Only show files with risk score >= 50
covergap coverage/lcov.info --min-risk 50 --text
```

### Sample output (--stats)

```
covergap: digest ~380 tokens | raw ~42,000 tokens | 99% smaller | 87 files, 23 under-tested, 4 uncovered | 61.2% overall line coverage
```

### Sample output (--text, trimmed)

```
COVERGAP
SOURCE: /home/user/project/coverage/lcov.info  [lcov]
STATS: digest ~380 tokens | raw ~42,000 tokens | 99% smaller
FILES: 87 total | 23 under-tested (<80% lines) | 4 uncovered
OVERALL LINE COV: 61.2%

[risk 97] src/payments/processor.ts  (312/340 lines uncovered)
  lines: 8.2%  branches: 5.0%  functions: 6.7%
  only 8.2% line coverage - nearly all 312 executable lines are untested

[risk 84] src/auth/oauth.ts  (88/110 lines uncovered)
  lines: 20.0%  branches: 14.0%  functions: 22.2%
  only 20.0% line coverage - nearly all 88 executable lines are untested

[risk 72] src/utils/transform.ts  (54/200 lines uncovered)
  lines: 73.0%  branches: 41.0%  functions: 80.0%
  73.0% line coverage but 54 absolute uncovered lines - large file with significant gaps
```

## Library Usage

```ts
import { getCoverGap } from 'covergap';

const digest = await getCoverGap('./coverage/lcov.info');

console.log(digest.stats);
// {
//   tokenEstimate: 380, rawEstimate: 42000, savedPercent: 99,
//   totalFiles: 87, undertested: 23, uncovered: 4,
//   overallLinePct: 61.2
// }

console.log(digest.files[0]);
// {
//   path: 'src/payments/processor.ts',
//   lines: 8.2, branches: 5.0, functions: 6.7, statements: null,
//   uncoveredLines: 312, totalLines: 340,
//   riskScore: 97,
//   reason: 'only 8.2% line coverage - nearly all 312 executable lines are untested'
// }
```

### With options

```ts
import { getCoverGap, formatMarkdown } from 'covergap';

const digest = await getCoverGap('./coverage/coverage-final.json', {
  limit: 10,      // top 10 riskiest files only
  minRisk: 40,    // skip files with risk score below 40
});

console.log(formatMarkdown(digest));
```

## Output schema

```ts
interface CoverGapDigest {
  source:        string;                  // absolute path to the coverage file
  sourceFormat:  "lcov" | "istanbul-json";
  files:         FileCoverage[];          // ranked by riskScore descending
  stats:         CoverGapStats;
  generatedAt:   string;                  // ISO 8601
}

interface FileCoverage {
  path:           string;
  statements:     number | null; // statement coverage % (Istanbul JSON only)
  branches:       number | null;
  functions:      number | null;
  lines:          number | null;
  uncoveredLines: number;        // executable lines with zero hits
  totalLines:     number;
  riskScore:      number;        // 0-100, higher = more urgent
  reason:         string;
}

interface CoverGapStats {
  tokenEstimate:  number;
  rawEstimate:    number;
  savedPercent:   number;
  totalFiles:     number;
  undertested:    number;        // files below 80% line coverage
  uncovered:      number;        // files at 0% line coverage
  overallLinePct: number | null;
}
```

## Risk score formula

```
base      = (1 - linePct / 100) * 70
sizeBoost = min(uncoveredLines / 200, 1) * 30
riskScore = round(base + sizeBoost)   // clamped 0-100
```

70% weight on coverage gap, 30% on absolute uncovered line count. A 200-line file at 0% coverage scores 100; a 10-line file at 0% scores 70. This stops tiny untouched files from beating large partially-covered ones.

## Heuristics and caveats

**Format detection.** Extension first (`.info` -> lcov, `.json` -> Istanbul JSON), then content heuristics (`SF:` prefix for lcov, valid JSON object for Istanbul). Explicit extension wins.

**Statement coverage in lcov.** lcov doesn't emit separate statement counts; `statements` is always `null` for lcov-sourced digests.

**Branch coverage in lcov.** Comes from `BRDA:`/`BRF:`/`BRH:` records. If branch instrumentation was disabled, `branches` will be `null`.

**Line coverage from Istanbul JSON.** When the `l` map is absent, line coverage is derived from `statementMap` + `s`, grouping hits by start line. Same approach Istanbul uses for its HTML report.

**Path format.** Istanbul JSON uses absolute paths; lcov uses paths as reported by the test runner (often project-relative). Passed through unchanged.

**Files with zero executable lines.** `LF:0` in lcov or empty `statementMap` in JSON gives `lines: null` and base risk 70. These are usually type-only files or generated code - add them to your coverage exclusion list if intentionally untested.

**`--min-risk` applies before `--limit`.** Files are scored, filtered by min-risk, then the top N are taken.

## Supported coverage tools

| Tool | Output file | Format |
|------|-------------|--------|
| vitest `--coverage` (v8 provider) | `coverage/lcov.info` | lcov |
| vitest `--coverage` (istanbul provider) | `coverage/coverage-final.json` | istanbul-json |
| c8 `--reporter=lcov` | `coverage/lcov.info` | lcov |
| c8 `--reporter=json` | `coverage/coverage-final.json` | istanbul-json |
| nyc `--reporter=lcov` | `coverage/lcov.info` | lcov |
| nyc `--reporter=json` | `coverage/coverage-final.json` | istanbul-json |
| Istanbul CLI | `coverage/lcov.info` or `coverage-final.json` | lcov / istanbul-json |
| Jest `--coverage` (default) | `coverage/lcov.info` + `coverage-final.json` | both |

## Token savings

A typical 100-file project generates a `lcov.info` around 200 KB (~50,000 tokens raw). The covergap digest of the top 20 riskiest files is around 500 tokens.

## License

MIT - see [LICENSE](./LICENSE)
