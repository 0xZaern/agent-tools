/**
 * risk signal detection: identifies patterns that warrant closer review.
 *
 * Signals:
 *  1. missingTests — logic files changed but no matching test file
 *  2. schemaTouched — migration / schema files in the diff
 *  3. authOrSecretPatterns — added lines with auth/credential indicators
 */

import { FileChange, RiskSignals } from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true if a path looks like a test file */
function isTestFile(path: string): boolean {
  return (
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(path) ||
    /(^|\/)__tests__\//.test(path) ||
    /(^|\/)tests?\//.test(path)
  );
}

/** Returns true if a path looks like application logic (non-test, non-config) */
function isLogicFile(path: string): boolean {
  return (
    /\.[cm]?[jt]sx?$/.test(path) &&
    !isTestFile(path) &&
    !/\.(config|setup|fixture|mock)\.[cm]?[jt]sx?$/.test(path)
  );
}

/** Returns true if a path is a schema or migration file */
function isSchemaFile(path: string): boolean {
  return (
    /schema\.prisma$/.test(path) ||
    /migrations?\//.test(path) ||
    /\.(sql|ddl)$/.test(path) ||
    /drizzle\.config\.[cm]?[jt]s$/.test(path) ||
    /schema\.[cm]?[jt]s$/.test(path)
  );
}

// Auth/secret patterns on added lines
const AUTH_PATTERNS: RegExp[] = [
  /api[_-]?key\s*[:=]/i,
  /secret[_-]?key\s*[:=]/i,
  /auth[_-]?token\s*[:=]/i,
  /password\s*[:=]/i,
  /private[_-]?key\s*[:=]/i,
  /access[_-]?token\s*[:=]/i,
  /bearer\s+[A-Za-z0-9_\-\.]{10,}/i,
  /-----BEGIN\s+(RSA|EC|OPENSSH|PRIVATE)/,
  /\beval\s*\(/,
  /process\.env\.[A-Z_]{5,}\s*=(?!=)/,
];

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

export function detectRiskSignals(files: FileChange[], rawDiff: string): RiskSignals {
  const logicFiles: string[] = [];
  const testFiles: string[] = [];
  const schemaFiles: string[] = [];
  const authFiles: string[] = [];

  for (const f of files) {
    if (f.changeType === "delete") continue;

    if (isSchemaFile(f.path)) {
      schemaFiles.push(f.path);
    }

    if (isLogicFile(f.path)) {
      logicFiles.push(f.path);
    }

    if (isTestFile(f.path)) {
      testFiles.push(f.path);
    }
  }

  // Missing tests: logic files changed, zero test files touched
  const missingTestsFiles: string[] = [];
  if (logicFiles.length > 0 && testFiles.length === 0) {
    missingTestsFiles.push(...logicFiles);
  }

  // Auth/secret: scan added lines in raw diff
  const addedLines = rawDiff
    .split("\n")
    .filter((l) => l.startsWith("+") && !l.startsWith("+++"));

  const authLineFiles: string[] = [];
  // Build a quick map: which files contain suspicious added lines
  // We'll do a simpler scan: if any added line matches patterns, flag the file
  const filePathRe = /^diff --git a\/(.+) b\/(.+)$/;
  let currentFile = "";
  for (const line of rawDiff.split("\n")) {
    const fpMatch = filePathRe.exec(line);
    if (fpMatch) {
      currentFile = fpMatch[2] ?? "";
      continue;
    }
    if (line.startsWith("+") && !line.startsWith("+++")) {
      for (const pat of AUTH_PATTERNS) {
        if (pat.test(line) && currentFile && !authLineFiles.includes(currentFile)) {
          authLineFiles.push(currentFile);
          break;
        }
      }
    }
  }

  return {
    missingTests: missingTestsFiles.length > 0,
    schemaTouched: schemaFiles.length > 0,
    authOrSecretPatterns: authLineFiles.length > 0,
    triggerFiles: {
      missingTests: missingTestsFiles,
      schema: schemaFiles,
      authOrSecret: authLineFiles,
    },
  };
}
