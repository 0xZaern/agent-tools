#!/usr/bin/env node
/**
 * agent-skills MCP server
 *
 * Exposes the agent-skills collection (devpulse, codemap) as native MCP tools
 * for MCP-compatible editors and AI workflows.
 *
 * Transport: stdio (reads from stdin, writes to stdout).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getRepoDigest, formatJson as digestJson, formatMarkdown as digestMd, formatText as digestText } from "devpulse";
import { getCodemap, formatJson as mapJson, formatMarkdown as mapMd, formatText as mapText } from "codemap";
import { getApiDigest, formatJson as apiJson, formatMarkdown as apiMd, formatText as apiText } from "apiscout";
import { getAuditDigest, formatJson as auditJson, formatMarkdown as auditMd, formatText as auditText } from "auditsnap";
import { getSecretScanDigest, formatJson as secretJson, formatMarkdown as secretMd, formatText as secretText } from "secretscan";
import { getSchemaDigest, formatJson as schemaJson, formatMarkdown as schemaMd, formatText as schemaText } from "schemadiff";
import { getLogDigest, formatJson as logJson, formatMarkdown as logMd, formatText as logText } from "logfold";
import { getDiffDigest, formatJson as diffJson, formatMarkdown as diffMd, formatText as diffText } from "diffdigest";
import { getDepGraph, formatJson as depJson, formatMarkdown as depMd, formatText as depText } from "depgraph";
import { getReleaseMap, formatJson as releaseJson, formatMarkdown as releaseMd, formatText as releaseText } from "releasemap";
import { getTestGen, formatJson as testJson, formatMarkdown as testMd, formatText as testText } from "testgen";

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const server = new McpServer(
  { name: "agent-skills", version: "1.0.0" },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ---------------------------------------------------------------------------
// Tool: repo_digest
// ---------------------------------------------------------------------------

server.tool(
  "repo_digest",
  "Produce a token-efficient digest of a GitHub repository. Returns structured metadata, pruned file tree, key file summaries, language breakdown, and recent commits — at a fraction of the raw token cost of reading the repo directly.",
  {
    repo: z.string().describe("GitHub repository slug in owner/name format, e.g. facebook/react"),
    format: z
      .enum(["json", "md", "text"])
      .optional()
      .describe("Output format: json (default, compact), md (markdown), text (plain)"),
    maxTokens: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Soft token budget — trims the digest to approximately this many tokens"),
    noCache: z
      .boolean()
      .optional()
      .describe("When true, skip the 60-minute disk cache and fetch fresh from GitHub"),
    token: z
      .string()
      .optional()
      .describe("GitHub personal access token. Increases rate limit from 60 to 5000 req/hr"),
  },
  async (args) => {
    const { repo, format = "json", maxTokens, noCache, token } = args;

    const digest = await getRepoDigest(repo, {
      format,
      maxTokens,
      noCache,
      token,
    });

    let output: string;
    switch (format) {
      case "md":
        output = digestMd(digest);
        break;
      case "text":
        output = digestText(digest);
        break;
      default:
        output = digestJson(digest);
    }

    return {
      content: [{ type: "text" as const, text: output }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: codemap
// ---------------------------------------------------------------------------

server.tool(
  "codemap",
  "Produce a token-efficient map of a local codebase. Walks the directory, extracts exported symbols and signatures from TypeScript/JavaScript files (using the TS compiler API), and returns a compact structured overview — so an AI agent can understand the project without reading every file.",
  {
    path: z
      .string()
      .optional()
      .describe("Absolute or relative path to the root directory to map. Defaults to current working directory."),
    format: z
      .enum(["json", "md", "text"])
      .optional()
      .describe("Output format: json (default, compact), md (markdown), text (plain)"),
    maxTokens: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Soft token budget — trims the map to approximately this many tokens"),
  },
  async (args) => {
    const { path: rootPath = ".", format = "json", maxTokens } = args;

    const codemap = await getCodemap(rootPath, { format, maxTokens });

    let output: string;
    switch (format) {
      case "md":
        output = mapMd(codemap);
        break;
      case "text":
        output = mapText(codemap);
        break;
      default:
        output = mapJson(codemap);
    }

    return {
      content: [{ type: "text" as const, text: output }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: apiscout
// ---------------------------------------------------------------------------

server.tool(
  "apiscout",
  "Produce a token-efficient digest of an OpenAPI or Swagger spec. Returns endpoint summaries grouped by tag, auth schemes, parameter tables, and schema field lists — at a fraction of the raw spec token cost. Accepts a local file path or a URL.",
  {
    source: z
      .string()
      .describe("Path to a local OpenAPI/Swagger file, or a URL (http/https)"),
    format: z
      .enum(["json", "md", "text"])
      .optional()
      .describe("Output format: json (default, compact), md (markdown), text (plain)"),
    maxTokens: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Soft token budget — trims the digest to approximately this many tokens"),
    endpoint: z
      .string()
      .optional()
      .describe("Drill into a single path, e.g. /users/{id}. Returns only operations for that path."),
  },
  async (args) => {
    const { source, format = "json", maxTokens, endpoint } = args;

    const digest = await getApiDigest(source, { format, maxTokens, endpoint });

    let output: string;
    switch (format) {
      case "md":
        output = apiMd(digest);
        break;
      case "text":
        output = apiText(digest);
        break;
      default:
        output = apiJson(digest);
    }

    return {
      content: [{ type: "text" as const, text: output }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: auditsnap
// ---------------------------------------------------------------------------

server.tool(
  "auditsnap",
  "Produce a token-efficient digest of npm audit output. Runs npm audit --json in the target directory and returns a ranked vulnerability list sorted by severity with fix-available flags and direct/transitive labels — at a fraction of the raw audit output token cost.",
  {
    dir: z
      .string()
      .optional()
      .describe("Absolute path to the directory to run npm audit in. Defaults to current working directory."),
    format: z
      .enum(["json", "md", "text"])
      .optional()
      .describe("Output format: json (default, compact), md (markdown), text (plain)"),
    maxTokens: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Soft token budget — trims the digest to approximately this many tokens"),
  },
  async (args) => {
    const { dir = ".", format = "json", maxTokens } = args;

    const digest = await getAuditDigest({ dir, format, maxTokens });

    let output: string;
    switch (format) {
      case "md":
        output = auditMd(digest);
        break;
      case "text":
        output = auditText(digest);
        break;
      default:
        output = auditJson(digest);
    }

    return {
      content: [{ type: "text" as const, text: output }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: secretscan
// ---------------------------------------------------------------------------

server.tool(
  "secretscan",
  "Scan a git repository for leaked secrets and credentials before they reach the remote. Checks staged files (default), tracked files, or the full tree against patterns for AWS keys, OpenAI/Stripe keys, GitHub tokens, JWTs, private key blocks, bearer tokens, hardcoded passwords, and connection strings. Never prints full secret values — output masks to first/last 4 characters. Returns a structured findings list with file, line, secret type, severity. Clean result means safe to commit.",
  {
    dir: z
      .string()
      .optional()
      .describe("Absolute path to the git repository root to scan. Defaults to current working directory."),
    source: z
      .enum(["staged", "tracked", "all"])
      .optional()
      .describe('Which files to scan: "staged" (default, ideal for pre-commit), "tracked" (all git-tracked files), "all" (tracked + untracked, respecting .gitignore)'),
    format: z
      .enum(["json", "md", "text"])
      .optional()
      .describe("Output format: json (default, compact), md (markdown), text (plain)"),
    entropy: z
      .boolean()
      .optional()
      .describe("Enable Shannon entropy check to flag high-entropy strings that may be unlabelled secrets (off by default)"),
    entropyThreshold: z
      .number()
      .positive()
      .optional()
      .describe("Minimum Shannon entropy (bits per character) to flag when --entropy is enabled. Defaults to 4.5."),
  },
  async (args) => {
    const { dir = ".", source = "staged", format = "json", entropy, entropyThreshold } = args;

    const digest = await getSecretScanDigest({ dir, source, format, entropy, entropyThreshold });

    let output: string;
    switch (format) {
      case "md":
        output = secretMd(digest);
        break;
      case "text":
        output = secretText(digest);
        break;
      default:
        output = secretJson(digest);
    }

    return {
      content: [{ type: "text" as const, text: output }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: schemadiff
// ---------------------------------------------------------------------------

server.tool(
  "schemadiff",
  "Produce a token-efficient digest of a database schema. Reads a Prisma schema.prisma, SQL DDL file, or Drizzle TypeScript schema and returns a compact ERD-style digest with entities, fields (name, type, nullable, PK/unique), foreign-key relations, and indexes — at a fraction of the raw schema token cost.",
  {
    source: z
      .string()
      .describe(
        "Path to a schema file or directory (schema.prisma, *.sql, *.ddl, drizzle *.ts, or a migrations/ directory)"
      ),
    format: z
      .enum(["json", "md", "text"])
      .optional()
      .describe("Output format: json (default, compact), md (markdown), text (plain)"),
    maxTokens: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Soft token budget — trims the digest to approximately this many tokens"),
    model: z
      .string()
      .optional()
      .describe("Drill into a single entity/table by name"),
    parser: z
      .enum(["prisma", "sql", "drizzle"])
      .optional()
      .describe("Force a specific parser. Auto-detected from extension and content by default."),
  },
  async (args) => {
    const { source, format = "json", maxTokens, model, parser } = args;

    const digest = await getSchemaDigest(source, { format, maxTokens, model, parser });

    let output: string;
    switch (format) {
      case "md":
        output = schemaMd(digest);
        break;
      case "text":
        output = schemaText(digest);
        break;
      default:
        output = schemaJson(digest);
    }

    return {
      content: [{ type: "text" as const, text: output }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: logfold
// ---------------------------------------------------------------------------

server.tool(
  "logfold",
  "Produce a token-efficient digest of error logs and stack traces. Reads a log file, deduplicates repeated errors, folds node_modules/stdlib/site-packages noise out of each stack trace, groups by error signature, counts occurrences, and records first/last timestamps — returning a compact structured summary at a fraction of the raw log token cost. Supports Node.js, Python, Java, and generic log formats.",
  {
    source: z
      .string()
      .describe("Absolute or relative path to a log file"),
    format: z
      .enum(["json", "md", "text"])
      .optional()
      .describe("Output format: json (default, compact), md (markdown), text (plain)"),
    maxTokens: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Soft token budget — trims the digest to approximately this many tokens"),
    top: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Show only the top N most-frequent error groups"),
  },
  async (args) => {
    const { source, format = "json", maxTokens, top } = args;

    const digest = await getLogDigest(source, { format, maxTokens, top });

    let output: string;
    switch (format) {
      case "md":
        output = logMd(digest);
        break;
      case "text":
        output = logText(digest);
        break;
      default:
        output = logJson(digest);
    }

    return {
      content: [{ type: "text" as const, text: output }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: diffdigest
// ---------------------------------------------------------------------------

server.tool(
  "diffdigest",
  "Produce a token-efficient digest of a git diff or GitHub PR. Accepts a local diff file, a GitHub PR URL, or piped unified diff text. Returns a structured change summary: total files, insertions/deletions, per-file change type, hunk counts, net lines, changed symbol names (TS/JS), and risk signals (missing tests, schema files touched, auth/secret patterns) — at a fraction of raw diff token cost.",
  {
    source: z
      .string()
      .optional()
      .describe("Path to a .diff/.patch file or a GitHub PR URL (https://github.com/owner/repo/pull/N). Omit to read from stdin."),
    format: z
      .enum(["json", "md", "text"])
      .optional()
      .describe("Output format: json (default, compact), md (markdown), text (plain)"),
    maxTokens: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Soft token budget — trims the digest to approximately this many tokens"),
    file: z
      .string()
      .optional()
      .describe("Drill into a specific file path within the diff"),
    token: z
      .string()
      .optional()
      .describe("GitHub personal access token for private repos or higher rate limits"),
  },
  async (args) => {
    const { source = null, format = "json", maxTokens, file, token } = args;

    const digest = await getDiffDigest(source, { format, maxTokens, file, token });

    let output: string;
    switch (format) {
      case "md":
        output = diffMd(digest);
        break;
      case "text":
        output = diffText(digest);
        break;
      default:
        output = diffJson(digest);
    }

    return {
      content: [{ type: "text" as const, text: output }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: depgraph
// ---------------------------------------------------------------------------

server.tool(
  "depgraph",
  "Produce a token-efficient import/export graph digest of a local TypeScript/JavaScript project. Walks the directory, uses the TypeScript compiler API to build an adjacency list of import edges, detects circular dependencies via DFS, identifies entry points and the most-imported files — at a fraction of the raw file-read token cost.",
  {
    path: z
      .string()
      .optional()
      .describe("Absolute or relative path to the project root directory. Defaults to current working directory."),
    format: z
      .enum(["json", "md", "text"])
      .optional()
      .describe("Output format: json (default, compact), md (markdown), text (plain)"),
    maxTokens: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Soft token budget — trims the digest to approximately this many tokens"),
    file: z
      .string()
      .optional()
      .describe("Drill into a specific file — show its full import/export list"),
    maxDepth: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe("Maximum directory traversal depth"),
  },
  async (args) => {
    const { path: rootPath = ".", format = "json", maxTokens, file, maxDepth } = args;

    const digest = await getDepGraph(rootPath, { format, maxTokens, file, maxDepth });

    let output: string;
    switch (format) {
      case "md":
        output = depMd(digest);
        break;
      case "text":
        output = depText(digest);
        break;
      default:
        output = depJson(digest);
    }

    return {
      content: [{ type: "text" as const, text: output }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: releasemap
// ---------------------------------------------------------------------------

server.tool(
  "releasemap",
  "Produce a token-efficient changelog and release-notes digest. Accepts a local CHANGELOG.md file path, a GitHub owner/repo slug (reads GitHub Releases API), or an npm package name (reads npm registry). Returns a compact version timeline with breaking-change flags, added/changed/fixed/removed counts, and one-line summaries. Use --version for full notes of a specific release.",
  {
    target: z
      .string()
      .describe("A local CHANGELOG.md file path, GitHub owner/repo slug, or npm package name"),
    format: z
      .enum(["json", "md", "text"])
      .optional()
      .describe("Output format: json (default, compact), md (markdown), text (plain)"),
    maxTokens: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Soft token budget — trims the digest to approximately this many tokens"),
    since: z
      .string()
      .optional()
      .describe("Show only releases at or after this semver, e.g. '1.2.0'"),
    version: z
      .string()
      .optional()
      .describe("Drill into a single release version — returns full release notes"),
    limit: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Maximum number of releases to return"),
    token: z
      .string()
      .optional()
      .describe("GitHub personal access token for higher rate limits"),
  },
  async (args) => {
    const { target, format = "json", maxTokens, since, version, limit, token } = args;

    const digest = await getReleaseMap(target, { format, maxTokens, since, version, limit, token });

    let output: string;
    switch (format) {
      case "md":
        output = releaseMd(digest);
        break;
      case "text":
        output = releaseText(digest);
        break;
      default:
        output = releaseJson(digest);
    }

    return {
      content: [{ type: "text" as const, text: output }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: testgen
// ---------------------------------------------------------------------------

server.tool(
  "testgen",
  "Generate an edge-case test skeleton for a TypeScript/JavaScript source file. Reads exported function signatures via the TypeScript compiler API and emits test stubs covering null, undefined, empty, boundary, type-mismatch, and happy-path cases for vitest or jest — so an agent fills in expected values rather than writing the entire test structure.",
  {
    source: z
      .string()
      .describe("Absolute or relative path to a TypeScript or JavaScript source file"),
    format: z
      .enum(["json", "md", "text"])
      .optional()
      .describe("Output format: json (default, compact), md (markdown), text (ready-to-paste test file)"),
    maxTokens: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Soft token budget — trims the digest to approximately this many tokens"),
    framework: z
      .enum(["vitest", "jest"])
      .optional()
      .describe("Test framework to target: vitest (default) or jest"),
    functionName: z
      .string()
      .optional()
      .describe("Drill into a single function by name"),
  },
  async (args) => {
    const { source, format = "json", maxTokens, framework = "vitest", functionName } = args;

    const digest = await getTestGen(source, { format, maxTokens, framework, functionName });

    let output: string;
    switch (format) {
      case "md":
        output = testMd(digest);
        break;
      case "text":
        output = testText(digest);
        break;
      default:
        output = testJson(digest);
    }

    return {
      content: [{ type: "text" as const, text: output }],
    };
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Server is now running — stdio transport keeps the process alive
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Fatal: ${message}\n`);
  process.exit(1);
});
