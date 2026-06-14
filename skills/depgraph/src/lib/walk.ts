/**
 * walk: discover all TS/JS source files in a project directory,
 * respecting .gitignore-style exclusions (node_modules, dist, etc.).
 */

import fs from "node:fs";
import path from "node:path";

// Directories to always skip
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  ".next",
  ".nuxt",
  "build",
  "coverage",
  ".cache",
  "out",
  "__pycache__",
  ".turbo",
  ".vercel",
]);

// File extensions to include
const INCLUDE_EXTS = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);

// Files to skip
const SKIP_FILES = new Set([
  "vite.config.ts",
  "vite.config.js",
  "vitest.config.ts",
  "jest.config.ts",
  "jest.config.js",
  "webpack.config.js",
  "rollup.config.js",
  "eslint.config.js",
  "prettier.config.js",
]);

export function walkProject(root: string, maxDepth = Infinity): string[] {
  const results: string[] = [];

  function recurse(dir: string, depth: number): void {
    if (depth > maxDepth) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          recurse(path.join(dir, entry.name), depth + 1);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (INCLUDE_EXTS.has(ext) && !SKIP_FILES.has(entry.name)) {
          results.push(path.join(dir, entry.name));
        }
      }
    }
  }

  recurse(root, 0);
  return results;
}
