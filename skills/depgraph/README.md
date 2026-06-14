# depgraph

Hand an AI agent a compact import graph digest instead of making it trace dependencies file-by-file.

`depgraph` walks a TypeScript/JavaScript project, uses the TypeScript compiler API to extract import and export declarations, builds an in-memory adjacency list, detects circular dependency chains via DFS, identifies entry points (files not imported by anything), and surfaces the most-imported files (heaviest subtrees) — producing a structured digest at a fraction of the raw file-read token cost.

---

## Install

```sh
npx depgraph
```

Or as a library:

```sh
npm install depgraph
```

---

## CLI Usage

```
depgraph [path] [options]

ARGUMENTS
  path    Path to a TypeScript/JavaScript project directory (default: .)

OPTIONS
  --json            Output as compact JSON (default, agent-friendly)
  --md              Output as human-readable Markdown
  --text            Output as plain text
  --stats           Print only the token-savings summary line
  --file path       Drill into a specific file — show its full import/export list
  --max-tokens N    Trim the digest to approximately N tokens
  --max-depth N     Maximum directory traversal depth
  -h, --help        Show help
  --version         Show version
```

### Examples

```sh
# Map the current project
depgraph .

# Human-readable Markdown
depgraph ./my-project --md

# Just the savings summary
depgraph . --stats

# Drill into one file
depgraph . --file src/services/auth.ts

# Fit into a token budget and pipe to an agent
depgraph . --max-tokens 3000 --json | some-agent-cli
```

### Sample output (--stats)

```
depgraph: digest ~1,800 tokens | raw ~42,000 tokens | 96% smaller | 87 files, 210 edges, 2 cycles
```

### Sample output (--text, trimmed)

```
DEPGRAPH
ROOT: /home/user/my-project
STATS: digest ~1,800 tokens | raw ~42,000 tokens | 96% smaller
FILES: 87 | EDGES: 210 | CYCLES: 2

ENTRY POINTS:
  src/index.ts
  src/cli.ts

CYCLES:
  src/services/auth.ts -> src/utils/token.ts -> src/services/auth.ts

MOST IMPORTED:
  src/lib/db.ts (imported by 14)
  src/utils/logger.ts (imported by 11)
  src/types/index.ts (imported by 9)

FILES:
  src/cli.ts
    imports: src/lib/digest.ts, src/lib/format/index.ts
    exports: main
  src/lib/db.ts
    imports: src/config/env.ts
    exports: db, query, transaction
```

---

## Library Usage

```ts
import { getDepGraph } from 'depgraph';

const digest = await getDepGraph('./my-project');

console.log(digest.stats);
// { tokenEstimate: 1800, rawEstimate: 42000, savedPercent: 96, totalFiles: 87, totalEdges: 210, cycleCount: 2 }

console.log(digest.cycles);
// [{ files: ['src/services/auth.ts', 'src/utils/token.ts', 'src/services/auth.ts'] }]

console.log(digest.entryPoints);
// ['src/index.ts', 'src/cli.ts']
```

### Drill-down

```ts
import { getDepGraph, formatMarkdown } from 'depgraph';

const digest = await getDepGraph('.', {
  file: 'src/services/auth.ts',   // return only this file's node
});

console.log(formatMarkdown(digest));
```

---

## Output schema

```ts
interface DepGraphDigest {
  root:            string;        // absolute path to project root
  nodes:           FileNode[];
  cycles:          Cycle[];
  entryPoints:     string[];      // files not imported by anything
  heaviestSubtrees: Array<{ path: string; importedByCount: number }>;
  stats:           DepGraphStats;
  generatedAt:     string;        // ISO 8601
}

interface FileNode {
  path:           string;         // relative to project root
  imports:        string[];       // local files this file imports
  importedBy:     string[];       // local files that import this file
  importedByCount: number;
  exports:        ExportEntry[];  // named exports
}

interface Cycle {
  files: string[];  // cycle path (last entry == first entry to close the loop)
}
```

---

## What gets skipped

`depgraph` ignores:

- **Directories**: `node_modules/`, `dist/`, `.next/`, `build/`, `coverage/`, `.git/`
- **External imports**: npm packages and Node.js built-ins (`node:fs`, etc.)
- **Config files**: `vite.config.ts`, `jest.config.ts`, etc.

---

## Token savings

100-file TypeScript project: walking imports manually ≈ 40,000 tokens of file reads → digest ≈ 2,000 tokens = **95% reduction**.

---

## License

MIT — see [LICENSE](./LICENSE)
