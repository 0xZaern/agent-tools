/**
 * extract: use the TypeScript compiler API to pull export declarations and
 * import references from a single source file.
 */

import ts from "typescript";
import path from "node:path";
import fs from "node:fs";
import { DeadExport, ExportKind } from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve a local module specifier to an absolute path. Returns null for externals. */
function resolveSpecifier(
  specifier: string,
  fromFile: string,
  projectRoot: string
): string | null {
  // External module (npm package, node built-in, bun built-in)
  if (
    specifier.startsWith("node:") ||
    specifier.startsWith("bun:") ||
    (!specifier.startsWith(".") && !specifier.startsWith("/"))
  ) {
    return null;
  }

  const dir = path.dirname(fromFile);
  const base = path.resolve(dir, specifier);

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

  // .js -> .ts resolution for ESM TS projects
  if (base.endsWith(".js")) {
    candidates.push(base.slice(0, -3) + ".ts");
    candidates.push(base.slice(0, -3) + ".tsx");
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return path.relative(projectRoot, candidate).replace(/\\/g, "/");
    }
  }

  // Unresolved — still local
  return path.relative(projectRoot, base).replace(/\\/g, "/");
}

// ---------------------------------------------------------------------------
// Extract exports
// ---------------------------------------------------------------------------

export interface ExportRecord {
  name: string;
  kind: ExportKind;
  line: number;
}

export function extractExports(
  sourceFile: ts.SourceFile
): ExportRecord[] {
  const records: ExportRecord[] = [];
  const seen = new Set<string>();

  function lineOf(node: ts.Node): number {
    return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
  }

  function addRecord(name: string, kind: ExportKind, node: ts.Node): void {
    if (!seen.has(name)) {
      seen.add(name);
      records.push({ name, kind, line: lineOf(node) });
    }
  }

  function visit(node: ts.Node): void {
    const mods = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    const isExported = mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

    if (isExported) {
      if (ts.isFunctionDeclaration(node) && node.name) {
        addRecord(node.name.text, "function", node);
      } else if (ts.isClassDeclaration(node) && node.name) {
        addRecord(node.name.text, "class", node);
      } else if (ts.isInterfaceDeclaration(node)) {
        addRecord(node.name.text, "type", node);
      } else if (ts.isTypeAliasDeclaration(node)) {
        addRecord(node.name.text, "type", node);
      } else if (ts.isEnumDeclaration(node)) {
        addRecord(node.name.text, "enum", node);
      } else if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) {
            addRecord(decl.name.text, "const", node);
          }
        }
      }
    }

    // export default
    if (ts.isExportAssignment(node) && !node.isExportEquals) {
      addRecord("default", "default", node);
    }

    // export { a, b } (local re-exports without from-clause)
    if (ts.isExportDeclaration(node) && !node.moduleSpecifier && node.exportClause) {
      if (ts.isNamedExports(node.exportClause)) {
        for (const el of node.exportClause.elements) {
          addRecord(el.name.text, "re-export", el);
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return records;
}

// ---------------------------------------------------------------------------
// Extract imported names from a file (what this file consumes from locals)
// ---------------------------------------------------------------------------

export interface ImportRecord {
  /** Resolved relative path to the source being imported from */
  fromPath: string;
  /** Names imported (undefined = namespace/default/side-effect) */
  names: string[] | undefined;
}

export function extractImports(
  filePath: string,
  projectRoot: string,
  sourceFile: ts.SourceFile
): ImportRecord[] {
  const records: ImportRecord[] = [];

  function visit(node: ts.Node): void {
    // import ... from '...'
    if (ts.isImportDeclaration(node)) {
      const specifier = (node.moduleSpecifier as ts.StringLiteral).text;
      const resolved = resolveSpecifier(specifier, filePath, projectRoot);
      if (resolved !== null) {
        const names: string[] = [];
        if (node.importClause) {
          const clause = node.importClause;
          if (clause.name) {
            names.push(clause.name.text); // default import
          }
          if (clause.namedBindings) {
            if (ts.isNamespaceImport(clause.namedBindings)) {
              // namespace import — we treat as "consumes all"
              records.push({ fromPath: resolved, names: undefined });
              ts.forEachChild(node, visit);
              return;
            } else if (ts.isNamedImports(clause.namedBindings)) {
              for (const el of clause.namedBindings.elements) {
                // el.propertyName is the original name when aliased
                names.push(el.propertyName ? el.propertyName.text : el.name.text);
              }
            }
          }
        }
        records.push({ fromPath: resolved, names: names.length > 0 ? names : undefined });
      }
    }

    // export { a } from '...' — re-exports consume from the source
    if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const specifier = (node.moduleSpecifier as ts.StringLiteral).text;
      const resolved = resolveSpecifier(specifier, filePath, projectRoot);
      if (resolved !== null) {
        const names: string[] = [];
        if (node.exportClause && ts.isNamedExports(node.exportClause)) {
          for (const el of node.exportClause.elements) {
            // el.propertyName is the original name in the source
            names.push(el.propertyName ? el.propertyName.text : el.name.text);
          }
        }
        // export * from '...' — namespace re-export
        records.push({ fromPath: resolved, names: names.length > 0 ? names : undefined });
      }
    }

    // Dynamic import('...')
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1
    ) {
      const arg = node.arguments[0];
      if (arg && ts.isStringLiteral(arg)) {
        const resolved = resolveSpecifier(arg.text, filePath, projectRoot);
        if (resolved !== null) {
          records.push({ fromPath: resolved, names: undefined });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return records;
}

// ---------------------------------------------------------------------------
// Resolve specifier — re-exported for use in digest
// ---------------------------------------------------------------------------

export { resolveSpecifier };
