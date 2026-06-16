# agent-skills

A collection of small, focused skills that help AI agents and LLMs work with code and repos efficiently.

---

## Skills

| Skill | Description |
|------|-------------|
| [**devpulse**](./skills/devpulse) | Token-efficient GitHub repo context for AI agents — fetches a repo and returns a compact structured digest (metadata, file tree, key files, recent commits) at a fraction of the raw token cost. |
| [**codemap**](./skills/codemap) | Token-efficient local codebase map for AI agents — walks a directory, extracts exported symbols and one-line signatures from TypeScript/JavaScript files, and produces a compact structured overview so an LLM understands the project without reading every file. |
| [**apiscout**](./skills/apiscout) | Token-efficient OpenAPI/Swagger spec digest for AI agents — loads a local file or URL and returns endpoint summaries grouped by tag, auth schemes, and schema field lists so an agent understands an API without consuming the full spec. |
| [**auditsnap**](./skills/auditsnap) | Token-efficient npm audit digest for AI agents — runs npm audit and returns a ranked vulnerability summary sorted by severity with fix-available flags and direct/transitive labels at a fraction of the raw audit output token cost. |
| [**schemadiff**](./skills/schemadiff) | Token-efficient database schema digest for AI agents — reads Prisma, SQL DDL, or Drizzle schemas and returns a compact ERD-style digest with entities, fields, foreign-key relations, and indexes at a fraction of the raw schema token cost. |
| [**logfold**](./skills/logfold) | Token-efficient error log digest for AI agents — deduplicates repeated errors, folds stack-trace noise (node_modules, stdlib, site-packages), groups by error signature, counts occurrences, and records first/last timestamps at a fraction of the raw log token cost. |
| [**diffdigest**](./skills/diffdigest) | Token-efficient git diff and GitHub PR digest for AI agents — compresses a raw unified diff into a structured change summary with per-file change type, hunk counts, net lines, changed symbol names, and risk signals (missing tests, schema touched, auth patterns) at a fraction of raw diff token cost. |
| [**depgraph**](./skills/depgraph) | Token-efficient local dependency graph digest for AI agents — maps import/export edges for TypeScript/JavaScript projects, detects circular dependencies, identifies entry points and most-imported files at a fraction of raw file-read token cost. |
| [**releasemap**](./skills/releasemap) | Token-efficient changelog and release-notes digest for AI agents — parses CHANGELOG.md, GitHub Releases, or npm registry history and returns a compact version timeline with breaking-change flags, counts, and drill-down at a fraction of raw changelog token cost. |
| [**testgen**](./skills/testgen) | Token-efficient test skeleton generator for AI agents — reads TypeScript/JavaScript function signatures and emits edge-case test stubs (null, undefined, empty, boundary, type-mismatch) for vitest or jest so an agent fills in expected values rather than writing the entire test structure. |

---

## MCP Server

[**skills/mcp**](./skills/mcp) is an MCP (Model Context Protocol) server that exposes the skills above as native MCP tools for MCP-compatible editors and AI workflows.

Register it once in your MCP client config:

```json
{
  "mcpServers": {
    "agent-skills": {
      "command": "node",
      "args": ["/absolute/path/to/agent-skills/skills/mcp/dist/server.js"]
    }
  }
}
```

See [skills/mcp/README.md](./skills/mcp/README.md) for full setup instructions.

---

## License

MIT
