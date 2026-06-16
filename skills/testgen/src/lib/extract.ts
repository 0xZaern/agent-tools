/**
 * extract: use the TypeScript compiler API to extract function signatures
 * from a source file. Handles:
 *  - Named function declarations
 *  - Exported arrow functions (const foo = (...) => ...)
 *  - Class methods
 *  - Async variants of all the above
 */

import ts from "typescript";
import { FunctionParam, FunctionSignature } from "./types.js";

// ---------------------------------------------------------------------------
// Type printing
// ---------------------------------------------------------------------------

function typeToString(type: ts.TypeNode | undefined): string {
  if (!type) return "unknown";
  return type.getText();
}

// ---------------------------------------------------------------------------
// Parameter extraction
// ---------------------------------------------------------------------------

function extractParam(param: ts.ParameterDeclaration): FunctionParam {
  const name = ts.isIdentifier(param.name)
    ? param.name.text
    : param.name.getText();

  const type = typeToString(param.type);
  const optional = !!param.questionToken || !!param.initializer;
  const defaultValue = param.initializer?.getText();

  return { name, type, optional, defaultValue };
}

// ---------------------------------------------------------------------------
// JSDoc extraction
// ---------------------------------------------------------------------------

function extractJsDoc(node: ts.Node, sourceFile: ts.SourceFile): string | undefined {
  const fullText = sourceFile.getFullText();
  const nodeStart = node.getFullStart();
  const commentRanges = ts.getLeadingCommentRanges(fullText, nodeStart);

  if (!commentRanges || commentRanges.length === 0) return undefined;

  // Get the last comment range (most likely JSDoc)
  const last = commentRanges[commentRanges.length - 1];
  if (!last) return undefined;

  const text = fullText.slice(last.pos, last.end).trim();
  if (!text.startsWith("/**")) return undefined;

  // Strip /** ... */ and leading * per line
  return text
    .replace(/^\/\*\*/, "")
    .replace(/\*\/$/, "")
    .split("\n")
    .map((l) => l.replace(/^\s*\*\s?/, ""))
    .join("\n")
    .trim();
}

// ---------------------------------------------------------------------------
// Main extractor
// ---------------------------------------------------------------------------

export function extractFunctions(
  sourceFile: ts.SourceFile
): FunctionSignature[] {
  const result: FunctionSignature[] = [];

  function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
    const mods = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    return mods?.some((m) => m.kind === kind) ?? false;
  }

  function isExported(node: ts.Node): boolean {
    return hasModifier(node, ts.SyntaxKind.ExportKeyword);
  }

  function isAsync(node: ts.Node): boolean {
    return hasModifier(node, ts.SyntaxKind.AsyncKeyword);
  }

  function addSig(sig: FunctionSignature): void {
    // Deduplicate by name
    if (!result.find((s) => s.name === sig.name)) {
      result.push(sig);
    }
  }

  function visit(node: ts.Node): void {
    // function foo(...) { ... }
    if (ts.isFunctionDeclaration(node) && node.name) {
      const async_ = isAsync(node);
      addSig({
        name: node.name.text,
        kind: async_ ? "async-function" : "function",
        params: node.parameters.map(extractParam),
        returnType: typeToString(node.type),
        exported: isExported(node),
        async: async_,
        jsdoc: extractJsDoc(node, sourceFile),
      });
    }

    // const foo = (...) => ... or const foo = function(...) { ... }
    if (ts.isVariableStatement(node)) {
      const exported_ = isExported(node);
      for (const decl of node.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue;
        const name = decl.name.text;
        const init = decl.initializer;
        if (!init) continue;

        if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
          const async_ = isAsync(init);
          addSig({
            name,
            kind: ts.isArrowFunction(init)
              ? async_
                ? "async-arrow"
                : "arrow"
              : async_
              ? "async-function"
              : "function",
            params: init.parameters.map(extractParam),
            returnType: typeToString(init.type),
            exported: exported_,
            async: async_,
            jsdoc: extractJsDoc(node, sourceFile),
          });
        }
      }
    }

    // Class methods
    if (ts.isClassDeclaration(node)) {
      for (const member of node.members) {
        if (ts.isMethodDeclaration(member) && ts.isIdentifier(member.name)) {
          const async_ = isAsync(member);
          // Skip private methods
          if (hasModifier(member, ts.SyntaxKind.PrivateKeyword)) continue;

          addSig({
            name: member.name.text,
            kind: async_ ? "async-method" : "method",
            params: member.parameters.map(extractParam),
            returnType: typeToString(member.type),
            exported: true, // class methods are accessible if class is exported
            async: async_,
            jsdoc: extractJsDoc(member, sourceFile),
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return result;
}
