/**
 * extract: use the TypeScript compiler API to extract import and export
 * declarations from a single source file.
 */

import ts from "typescript";
import path from "node:path";
import fs from "node:fs";
import { ExportEntry, ImportEdge } from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve a module specifier relative to a source file to an absolute path */
function resolveSpecifier(
  specifier: string,
  fromFile: string,
  projectRoot: string
): { resolved: string; isLocal: boolean } | null {
  // Skip node built-ins and npm packages
  if (
    specifier.startsWith("node:") ||
    specifier.startsWith("bun:") ||
    (!specifier.startsWith(".") && !specifier.startsWith("/"))
  ) {
    return { resolved: specifier, isLocal: false };
  }

  const dir = path.dirname(fromFile);
  const base = path.resolve(dir, specifier);

  // Try direct match first
  const candidates = [
    base,
    base + ".ts",
    base + ".tsx",
    base + ".mts",
    base + ".cts",
    base + ".js",
    base + ".jsx",
    base + ".mjs",
    base + "/index.ts",
    base + "/index.tsx",
    base + "/index.js",
  ];

  // Also handle .js -> .ts resolution (ESM imports of TS often use .js extension)
  if (base.endsWith(".js")) {
    candidates.push(base.slice(0, -3) + ".ts");
    candidates.push(base.slice(0, -3) + ".tsx");
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const rel = path.relative(projectRoot, candidate);
      return { resolved: rel, isLocal: true };
    }
  }

  // Unresolved local — still mark as local attempt
  const rel = path.relative(projectRoot, base);
  return { resolved: rel, isLocal: true };
}

// ---------------------------------------------------------------------------
// Extract imports from a source file
// ---------------------------------------------------------------------------

export function extractImports(
  filePath: string,
  projectRoot: string,
  sourceFile: ts.SourceFile
): ImportEdge[] {
  const relPath = path.relative(projectRoot, filePath);
  const edges: ImportEdge[] = [];

  function visit(node: ts.Node): void {
    // import ... from '...'
    if (ts.isImportDeclaration(node)) {
      const specifier = (node.moduleSpecifier as ts.StringLiteral).text;
      const resolved = resolveSpecifier(specifier, filePath, projectRoot);
      if (!resolved) {
        ts.forEachChild(node, visit);
        return;
      }

      const names: string[] = [];
      if (node.importClause) {
        const clause = node.importClause;
        if (clause.name) {
          names.push(clause.name.text); // default import
        }
        if (clause.namedBindings) {
          if (ts.isNamespaceImport(clause.namedBindings)) {
            names.push(`* as ${clause.namedBindings.name.text}`);
          } else if (ts.isNamedImports(clause.namedBindings)) {
            for (const el of clause.namedBindings.elements) {
              names.push(el.name.text);
            }
          }
        }
      }

      edges.push({
        from: relPath,
        to: resolved.resolved,
        isLocal: resolved.isLocal,
        names: names.length > 0 ? names : undefined,
      });
    }

    // export ... from '...' (re-exports)
    if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const specifier = (node.moduleSpecifier as ts.StringLiteral).text;
      const resolved = resolveSpecifier(specifier, filePath, projectRoot);
      if (resolved) {
        edges.push({
          from: relPath,
          to: resolved.resolved,
          isLocal: resolved.isLocal,
          names: undefined,
        });
      }
    }

    // Dynamic import: import('...')
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1
    ) {
      const arg = node.arguments[0];
      if (arg && ts.isStringLiteral(arg)) {
        const specifier = arg.text;
        const resolved = resolveSpecifier(specifier, filePath, projectRoot);
        if (resolved) {
          edges.push({
            from: relPath,
            to: resolved.resolved,
            isLocal: resolved.isLocal,
            names: undefined,
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return edges;
}

// ---------------------------------------------------------------------------
// Extract exports from a source file
// ---------------------------------------------------------------------------

export function extractExports(sourceFile: ts.SourceFile): ExportEntry[] {
  const entries: ExportEntry[] = [];

  function addEntry(name: string, kind: string): void {
    if (!entries.find((e) => e.name === name)) {
      entries.push({ name, kind });
    }
  }

  function visit(node: ts.Node): void {
    const mods = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    const isExported = mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

    if (isExported) {
      if (ts.isFunctionDeclaration(node) && node.name) {
        addEntry(node.name.text, "function");
      } else if (ts.isClassDeclaration(node) && node.name) {
        addEntry(node.name.text, "class");
      } else if (ts.isInterfaceDeclaration(node)) {
        addEntry(node.name.text, "type");
      } else if (ts.isTypeAliasDeclaration(node)) {
        addEntry(node.name.text, "type");
      } else if (ts.isEnumDeclaration(node)) {
        addEntry(node.name.text, "variable");
      } else if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) {
            addEntry(decl.name.text, "variable");
          }
        }
      }
    }

    // export default
    if (ts.isExportAssignment(node) && !node.isExportEquals) {
      addEntry("default", "default");
    }

    // export { a, b } or export { a } from '...'
    if (ts.isExportDeclaration(node) && !node.moduleSpecifier && node.exportClause) {
      if (ts.isNamedExports(node.exportClause)) {
        for (const el of node.exportClause.elements) {
          addEntry(el.name.text, "re-export");
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return entries;
}
