# agent-skills

A collection of small, focused skills that help AI agents and LLMs work with code and repos efficiently.

---

## Skills

| Skill | What it digests | Token savings |
|-------|----------------|---------------|
| [**devpulse**](./skills/devpulse) | GitHub repo — metadata, file tree, key files, recent commits | ~90% |
| [**codemap**](./skills/codemap) | Local codebase — exported symbols, one-line signatures, pruned file tree | ~85% |
| [**apiscout**](./skills/apiscout) | OpenAPI/Swagger spec — endpoint summaries by tag, auth schemes, schema fields | ~80% |
| [**auditsnap**](./skills/auditsnap) | `npm audit` output — vulnerabilities ranked by severity, fix-available flags | ~75% |
| [**schemadiff**](./skills/schemadiff) | DB schema (Prisma/SQL/Drizzle) — ERD-style entities, relations, indexes | ~80% |
| [**logfold**](./skills/logfold) | Error logs — deduplicated, stack-noise folded, grouped by signature | ~90% |
| [**diffdigest**](./skills/diffdigest) | Git diff / GitHub PR — per-file summary, risk signals, changed symbols | ~85% |
| [**depgraph**](./skills/depgraph) | Import/export graph — entry points, circular deps, heaviest subtrees | ~80% |
| [**releasemap**](./skills/releasemap) | CHANGELOG.md / GitHub Releases / npm history — version timeline, breaking flags | ~98% |
| [**testgen**](./skills/testgen) | TS/JS source file — edge-case test stubs (null, boundary, type-mismatch) for vitest or jest | ~76% |
| [**deadcode**](./skills/deadcode) | TS/JS project — declared exports that are never imported anywhere, ranked by file with kind and line | ~99% |
| [**covergap**](./skills/covergap) | lcov.info / coverage-final.json — ranked digest of highest-risk under-tested files with risk score, coverage %, and uncovered line count | ~90% |

---

## MCP Server

[**skills/mcp**](./skills/mcp) is an MCP (Model Context Protocol) server that exposes all twelve skills above as native MCP tools for MCP-compatible editors and AI workflows.

Register it once in your MCP client config and all tools become available without any extra shell commands:

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
