# diffdigest

Hand an AI agent a compact diff digest instead of making it read a raw git diff.

`diffdigest` reads a unified diff from a local file, stdin (`git diff | diffdigest`), or a GitHub PR URL and produces a structured change summary: total files changed, insertions/deletions, per-file change type, hunk counts, net lines, changed symbol names (for TS/JS files), and risk signals (missing tests, schema files touched, auth/secret patterns in added lines) — at a fraction of the raw diff token cost.

---

## Install

```sh
npx diffdigest
```

Or as a library:

```sh
npm install diffdigest
```

---

## CLI Usage

```
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
  -h, --help        Show help
  --version         Show version
```

### Examples

```sh
# Pipe from git diff (most common use case)
git diff HEAD~1 | diffdigest

# Load from a saved patch file
diffdigest ./feature.diff --md

# GitHub PR
diffdigest https://github.com/owner/repo/pull/42

# Drill into one file
diffdigest ./big.diff --file src/auth/login.ts

# Just the savings summary
diffdigest ./big.diff --stats

# Fit into a token budget and pipe to an agent
git diff | diffdigest --max-tokens 2000 --json | some-agent-cli
```

### Sample output (--stats)

```
diffdigest: digest ~2,300 tokens | raw ~82,000 tokens | 97% smaller | 48 files +1,240/-890
```

### Sample output (--text, trimmed)

```
DIFFDIGEST
STATS: digest ~2,300 tokens | raw ~82,000 tokens | 97% smaller
SUMMARY: 48 files | +1,240/-890 net+350 | source: github-pr
RISK: missing-tests, schema-touched

[M] src/services/auth.ts
    +42/-18 net+24 | 3 hunks
    symbols: verifyToken, refreshSession, AuthError

[A] src/migrations/0014_add_sessions.sql
    +28/-0 net+28 | 1 hunks

[D] src/legacy/auth-v1.ts
    +0/-120 net-120 | 1 hunks
```

---

## Library Usage

```ts
import { getDiffDigest } from 'diffdigest';

// from a file
const digest = await getDiffDigest('./feature.diff');

// from a GitHub PR
const digest = await getDiffDigest('https://github.com/owner/repo/pull/42', {
  token: process.env.GITHUB_TOKEN,
});

// from stdin (pass null)
const digest = await getDiffDigest(null);

console.log(digest.stats);
// { tokenEstimate: 2300, rawEstimate: 82000, savedPercent: 97, totalFiles: 48, ... }

console.log(digest.riskSignals);
// { missingTests: true, schemaTouched: true, authOrSecretPatterns: false, triggerFiles: { ... } }
```

### Drill-down

```ts
import { getDiffDigest, formatMarkdown } from 'diffdigest';

const digest = await getDiffDigest('./big.diff', {
  file: 'src/auth/login.ts',   // return full hunk detail for this file only
});

console.log(formatMarkdown(digest));
```

---

## Output schema

```ts
interface DiffDigest {
  source:    string;          // "file" | "stdin" | "github-pr"
  summary: {
    totalFiles:  number;
    additions:   number;
    deletions:   number;
    netLines:    number;
  };
  files:     FileChange[];
  riskSignals: RiskSignals;
  stats:     DiffDigestStats;
  generatedAt: string;        // ISO 8601
}

interface FileChange {
  path:           string;
  fromPath?:      string;              // rename source
  changeType:     "add" | "modify" | "delete" | "rename";
  hunkCount:      number;
  netLines:       number;
  additions:      number;
  deletions:      number;
  hunks:          HunkSummary[];
  changedSymbols: string[];            // TS/JS only, up to 20
}

interface RiskSignals {
  missingTests:        boolean;
  schemaTouched:       boolean;
  authOrSecretPatterns: boolean;
  triggerFiles: {
    missingTests: string[];
    schema:       string[];
    authOrSecret: string[];
  };
}
```

---

## Risk signals

| Signal | Condition |
|--------|-----------|
| **missingTests** | Logic files (`.ts/.js`, non-test) were changed but zero test files appear in the diff |
| **schemaTouched** | Any file matching `schema.prisma`, `migrations/`, `*.sql`, `*.ddl` was modified |
| **authOrSecretPatterns** | Added lines contain `api_key =`, `password =`, `bearer <token>`, `-----BEGIN PRIVATE KEY`, `eval(`, or similar patterns |

---

## Token savings

50-file PR with 2,000 changed lines: raw diff ≈ 80,000 tokens → digest ≈ 2,500 tokens = **97% reduction** before any drill-down.

---

## License

MIT — see [LICENSE](./LICENSE)
