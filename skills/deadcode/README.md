# deadcode

Hand an AI agent a compact dead-export digest instead of making it grep every file for unused symbols.

`deadcode` walks a TypeScript/JavaScript project, uses the TypeScript compiler API to extract every named export declaration and every import reference, cross-references them to find exports that are never imported by any local file, and returns a ranked structured digest — at a fraction of the raw file-read token cost. It pairs naturally with `depgraph`, which maps the full import/export edge graph.

---

## Install

```sh
npx deadcode
```

Or as a library:

```sh
npm install deadcode
```

---

## CLI Usage

```
deadcode [path] [options]

ARGUMENTS
  path    Path to a TypeScript/JavaScript project directory (default: .)

OPTIONS
  --json            Output as compact JSON (agent-friendly)
  --md              Output as human-readable Markdown
  --text            Output as plain text (default)
  --stats           Print only the token-savings and dead-export summary line
  --limit N         Return only the first N dead-export entries (across all files)
  --max-depth N     Maximum directory traversal depth
  -h, --help        Show help
  --version         Show version
```

### Examples

```sh
# Scan the current project (plain text)
deadcode .

# Markdown report
deadcode ./my-project --md

# Just the summary line
deadcode . --stats

# Fit into a token budget and pipe to an agent
deadcode . --limit 100 --json | some-agent-cli

# Shallow scan (2 levels deep only)
deadcode . --max-depth 2 --text
```

### Sample output (--stats)

```
deadcode: digest ~120 tokens | raw ~38,000 tokens | 99% smaller | 94 files, 210 exports, 17 dead (8%)
```

### Sample output (--text, trimmed)

```
DEADCODE
ROOT: /home/user/my-project
STATS: digest ~120 tokens | raw ~38,000 tokens | 99% smaller
FILES: 94 scanned | EXPORTS: 210 total | DEAD: 17 (8%)

src/utils/legacy.ts  (4 dead)
  L12  function  formatDateLegacy
  L28  const     OLD_API_URL
  L45  class     LegacyAdapter
  L78  type      LegacyConfig

src/services/auth.ts  (2 dead)
  L102  function  debugTokenDump
  L134  const     INTERNAL_SECRET_KEY
```

---

## Library Usage

```ts
import { getDeadCode } from 'deadcode';

const digest = await getDeadCode('./my-project');

console.log(digest.stats);
// {
//   tokenEstimate: 120, rawEstimate: 38000, savedPercent: 99,
//   totalFiles: 94, totalExports: 210, deadCount: 17, deadPercent: 8
// }

console.log(digest.files[0]);
// {
//   path: 'src/utils/legacy.ts',
//   exports: [
//     { name: 'formatDateLegacy', kind: 'function', line: 12 },
//     { name: 'OLD_API_URL',       kind: 'const',    line: 28 },
//   ]
// }
```

### With options

```ts
import { getDeadCode, formatMarkdown } from 'deadcode';

const digest = await getDeadCode('.', {
  limit: 50,       // cap at 50 dead entries
  maxDepth: 3,     // scan at most 3 directory levels deep
});

console.log(formatMarkdown(digest));
```

---

## Output schema

```ts
interface DeadCodeDigest {
  root:        string;       // absolute path to project root
  files:       DeadFile[];   // files with dead exports, ranked by count desc
  stats:       DeadCodeStats;
  generatedAt: string;       // ISO 8601
}

interface DeadFile {
  path:    string;        // relative to project root
  exports: DeadExport[];  // dead exports within this file, sorted by line
}

interface DeadExport {
  name: string;      // exported symbol name
  kind: ExportKind;  // "function" | "class" | "type" | "const" | "enum" | "default" | "re-export"
  line: number;      // 1-based line number of the declaration
}

interface DeadCodeStats {
  tokenEstimate: number;  // tokens in this digest (~chars/4)
  rawEstimate:   number;  // tokens to read all source files raw
  savedPercent:  number;  // % reduction vs raw
  totalFiles:    number;  // source files scanned
  totalExports:  number;  // total named exports found
  deadCount:     number;  // exports never imported by any local file
  deadPercent:   number;  // deadCount / totalExports * 100
}
```

---

## How detection works

1. **Walk** — discover all `.ts/.tsx/.js/.jsx` files, skipping `node_modules/`, `dist/`, `build/`, `.git/`, and common config files.
2. **Parse exports** — for each file, use the TypeScript compiler API to collect every named export: `export function`, `export class`, `export const`, `export type`, `export interface`, `export enum`, `export default`, and local `export { x }` clauses.
3. **Parse imports** — for each file, collect every named binding consumed from local (relative) modules: `import { x } from './y'`, `export { x } from './y'`, and dynamic `import('./y')`.
4. **Cross-reference** — an export `x` from file `a.ts` is dead if no other local file imports the name `x` from `a.ts`.

---

## Heuristics and caveats

**Namespace imports mark files as fully consumed.** `import * as mod from './util'` makes every export in `util.ts` considered live, because any name could be accessed via `mod.x` at runtime. This is conservative but correct.

**Default exports of `index.*` files are never flagged.** A package's public entry point is almost always consumed by an external caller (the package consumer), not by a local file. Flagging `export default` from `index.ts` as dead would produce false positives for every published package. This heuristic is applied only when the file basename (without extension) is exactly `index`.

**Re-exports through barrel files.** An export that passes through a barrel (`export { x } from './a'`) is tracked. The name `x` is consumed from `a.ts` by the barrel. If the barrel's own re-exported name is then consumed by another file, the chain is live. If nothing imports from the barrel, both the barrel's re-export and the original export appear dead.

**Dynamic imports with non-literal specifiers** (`import(someVar)`) cannot be resolved statically and are ignored. If your project uses dynamic imports with computed paths, some exports may be reported as dead incorrectly — treat those findings with caution.

**Type-only exports** (`export type { Foo }`) are detected and reported with kind `"type"`. They are safe to remove when dead, as they have no runtime impact.

**This tool does not replace a full tree-shaker.** It operates on local file imports only. Exports consumed by test files, build scripts, or external packages will appear dead if those files are excluded or live outside the project root. Always review flagged symbols before removal.

---

## What gets skipped

`deadcode` ignores:

- **Directories**: `node_modules/`, `dist/`, `.next/`, `build/`, `coverage/`, `.git/`
- **External imports**: npm packages and Node.js built-ins (`node:fs`, etc.)
- **Config files**: `vite.config.ts`, `jest.config.ts`, etc.

---

## Token savings

100-file TypeScript project: reading all source files to find unused exports manually ≈ 40,000 tokens → digest ≈ 150 tokens = **99% reduction**.

---

## License

MIT — see [LICENSE](./LICENSE)
