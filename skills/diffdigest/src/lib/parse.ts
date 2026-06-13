/**
 * diff parser: reads unified diff text and produces per-file change entries.
 *
 * Uses parse-diff for the heavy lifting, then enriches each file with:
 *  - change type detection (add/modify/delete/rename)
 *  - hunk summaries
 *  - lightweight symbol extraction (TS/JS functions, classes, exports)
 */

import parseDiff from "parse-diff";
import { FileChange, FileChangeType, HunkSummary } from "./types.js";

// ---------------------------------------------------------------------------
// Symbol extraction (lightweight regex, not full AST)
// ---------------------------------------------------------------------------

const SYMBOL_PATTERNS: RegExp[] = [
  // exported function / async function
  /^\+\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/,
  // export const / let foo = () =>
  /^\+\s*export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/,
  // class declaration
  /^\+\s*(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/,
  // interface / type alias
  /^\+\s*(?:export\s+)?(?:interface|type)\s+([A-Za-z_$][\w$]*)/,
  // method definitions: public/private/protected async? name(
  /^\+\s*(?:(?:public|private|protected|static|async|override)\s+)*([A-Za-z_$][\w$]*)\s*\(/,
];

function extractSymbols(lines: parseDiff.Change[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const change of lines) {
    if (change.type !== "add") continue;
    const content = change.content;

    for (const pattern of SYMBOL_PATTERNS) {
      const m = pattern.exec(content);
      if (m && m[1]) {
        const name = m[1];
        // Filter out noise: common keywords that look like identifiers
        if (
          !seen.has(name) &&
          !["if", "for", "while", "switch", "return", "const", "let", "var", "new", "this"].includes(name)
        ) {
          seen.add(name);
          result.push(name);
        }
        break;
      }
    }
  }

  return result.slice(0, 20); // cap at 20 symbols per file
}

// ---------------------------------------------------------------------------
// Change type detection
// ---------------------------------------------------------------------------

function detectChangeType(file: parseDiff.File): FileChangeType {
  if (file.new === true || file.from === "/dev/null") return "add";
  if (file.deleted === true || file.to === "/dev/null") return "delete";
  if (file.from && file.to && file.from !== file.to) return "rename";
  return "modify";
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

export function parseDiffText(rawDiff: string): FileChange[] {
  const files = parseDiff(rawDiff);
  const result: FileChange[] = [];

  for (const file of files) {
    const changeType = detectChangeType(file);

    const path = file.to && file.to !== "/dev/null" ? file.to : (file.from ?? "unknown");
    const fromPath = changeType === "rename" ? file.from : undefined;

    let totalAdditions = 0;
    let totalDeletions = 0;
    const hunks: HunkSummary[] = [];
    const allChanges: parseDiff.Change[] = [];

    for (const chunk of file.chunks) {
      let hunkAdd = 0;
      let hunkDel = 0;

      for (const change of chunk.changes) {
        if (change.type === "add") {
          totalAdditions++;
          hunkAdd++;
        } else if (change.type === "del") {
          totalDeletions++;
          hunkDel++;
        }
        allChanges.push(change);
      }

      hunks.push({
        header: chunk.content,
        additions: hunkAdd,
        deletions: hunkDel,
      });
    }

    // Extract symbols only for TS/JS files
    const isJsTs = /\.[cm]?[jt]sx?$/.test(path);
    const changedSymbols = isJsTs ? extractSymbols(allChanges) : [];

    result.push({
      path,
      fromPath,
      changeType,
      hunkCount: hunks.length,
      netLines: totalAdditions - totalDeletions,
      additions: totalAdditions,
      deletions: totalDeletions,
      hunks,
      changedSymbols,
    });
  }

  return result;
}
