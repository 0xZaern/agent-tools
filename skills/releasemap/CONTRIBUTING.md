# Contributing to releasemap

## Setup

```sh
cd skills/releasemap
npm install
npm run build
```

The build step runs `tsc -p tsconfig.lib.json` and outputs to `dist/`.

## Project layout

```
src/
  cli.ts              — CLI entry point (parseArgs, format dispatch)
  lib/
    types.ts          — Public TypeScript types (ReleaseMapOptions, ReleaseEntry, etc.)
    digest.ts         — Top-level orchestrator: detect source → load → filter → stats
    loader.ts         — Data loaders: local CHANGELOG file, GitHub Releases API, npm registry
    parse-changelog.ts — Keep-a-Changelog parser (pure TypeScript, no external deps)
    format/
      index.ts        — Re-exports all formatters
      json.ts         — Compact JSON formatter (agent default)
      text.ts         — Plain-text formatter
      md.ts           — Markdown formatter with collapsible sections
```

## Adding a new source

1. Add a loader function in `src/lib/loader.ts`.
2. Add the new `SourceKind` variant to the union in `loader.ts` and `types.ts`.
3. Handle the new case in `getReleaseMap()` in `src/lib/digest.ts`.
4. Update `detectSourceKind()` to recognise the new target pattern.
5. Add an entry to the source-detection table in `README.md`.

## Adding a new formatter

1. Create `src/lib/format/<name>.ts` that exports a single `format<Name>(digest: ReleaseMapDigest): string` function.
2. Re-export it from `src/lib/format/index.ts`.
3. Wire the `--<name>` CLI flag in `src/cli.ts`.
4. Add a `format` option value to `ReleaseMapOptions["format"]` in `types.ts`.

## Code style

- TypeScript strict mode is on — no implicit `any`.
- No runtime dependencies beyond Node.js built-ins and `typescript` (dev-only).
- Keep `src/lib/parse-changelog.ts` free of I/O — it is a pure transform function.

## Testing changes manually

Use the bundled fixture:

```sh
node dist/cli.js ./examples/CHANGELOG.sample.md
node dist/cli.js ./examples/CHANGELOG.sample.md --since 3.0.0 --md
node dist/cli.js ./examples/CHANGELOG.sample.md --version 3.0.0
node dist/cli.js ./examples/CHANGELOG.sample.md --stats
```
