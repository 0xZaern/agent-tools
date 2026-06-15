# releasemap

Hand an AI agent a compact release timeline instead of making it read a full CHANGELOG.

`releasemap` digests a `CHANGELOG.md` file, a GitHub repository's releases, or an npm package's version history and returns a structured release timeline: version, date, breaking-change flag, one-line summary, and added/changed/fixed/removed counts — at a fraction of the raw changelog token cost. Use `--version` to drill into the full notes of a single release.

---

## Install

```sh
npx releasemap
```

Or as a library:

```sh
npm install releasemap
```

---

## CLI Usage

```
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
  -h, --help        Show help
```

### Examples

```sh
# Digest a local changelog
releasemap ./CHANGELOG.md

# Show only post-2.0 releases
releasemap ./CHANGELOG.md --since 2.0.0

# GitHub repo releases
releasemap facebook/react

# Drill into a specific version
releasemap facebook/react --version v18.0.0

# npm package
releasemap react --md

# Stats only
releasemap next --stats

# Token budget
releasemap ./CHANGELOG.md --max-tokens 2000 --json | some-agent-cli
```

### Sample output (--stats)

```
releasemap [changelog]: digest ~2,100 tokens | raw ~180,000 tokens | 98.8% smaller | 94 releases, 8 breaking
```

### Sample output (--text, trimmed)

```
RELEASEMAP
SOURCE: changelog | TARGET: ./CHANGELOG.md
STATS: digest ~2,100 tokens | raw ~180,000 tokens | 98.8% smaller
RELEASES: 94 | BREAKING: 8

v14.0.0 (2024-04-15) [BREAKING]
  Major refactor of routing system — nested layouts now required
  +12 added | ~8 changed | x3 fixed | -5 removed

v13.5.2 (2024-03-01)
  Fix hydration mismatch in Suspense boundaries
  x4 fixed
```

---

## Library Usage

```ts
import { getReleaseMap } from 'releasemap';

// From a local changelog
const digest = await getReleaseMap('./CHANGELOG.md');

// From GitHub
const digest = await getReleaseMap('facebook/react', {
  token: process.env.GITHUB_TOKEN,
});

// From npm
const digest = await getReleaseMap('next');

console.log(digest.stats);
// { tokenEstimate: 2100, rawEstimate: 180000, savedPercent: 98, totalReleases: 94, breakingCount: 8 }
```

### With filters

```ts
import { getReleaseMap, formatMarkdown } from 'releasemap';

// Only post-v2.0 releases
const digest = await getReleaseMap('./CHANGELOG.md', {
  since: '2.0.0',
});

// Full notes for one release
const drill = await getReleaseMap('./CHANGELOG.md', {
  version: 'v14.0.0',
});
console.log(drill.releases[0].body); // full markdown body
```

---

## Output schema

```ts
interface ReleaseMapDigest {
  source:    "changelog" | "github" | "npm";
  target:    string;
  releases:  ReleaseEntry[];
  stats:     ReleaseMapStats;
  generatedAt: string;  // ISO 8601
}

interface ReleaseEntry {
  version:  string;         // e.g. "2.1.0"
  date:     string | null;  // "YYYY-MM-DD" or null
  breaking: boolean;
  summary:  string;         // ≤120 chars, first non-empty line of release body
  added:    number;
  changed:  number;
  fixed:    number;
  removed:  number;
  body?:    string;         // only present with --version drill-down
}
```

---

## Example fixtures

The [`examples/`](./examples/) directory contains a ready-made input fixture you can use to try the CLI without needing a live CHANGELOG or internet access:

```sh
# Run against the bundled sample changelog
releasemap ./node_modules/releasemap/examples/CHANGELOG.sample.md

# Pipe through --stats to see the token-savings headline
releasemap ./node_modules/releasemap/examples/CHANGELOG.sample.md --stats

# Drill into a specific version
releasemap ./node_modules/releasemap/examples/CHANGELOG.sample.md --version 3.0.0
```

---

## Source detection

| Input | Source used |
|-------|------------|
| File path (`./CHANGELOG.md`) | Local file parser |
| `owner/repo` slug | GitHub Releases API |
| Package name (`react`, `@scope/pkg`) | npm registry |

---

## Breaking change detection

For local changelogs: scans release body for `BREAKING CHANGE`, `BREAKING:`, `[!]`, or `major version` keywords.

For GitHub Releases: scans both release title and body.

For npm: not available from registry metadata (always `false`).

---

## Token savings

Next.js CHANGELOG.md: ≈ 180,000 tokens raw → digest ≈ 2,500 tokens = **98.6% reduction**. Plus drill-down for a specific version adds ≈ 800 tokens.

---

## License

MIT — see [LICENSE](./LICENSE)
