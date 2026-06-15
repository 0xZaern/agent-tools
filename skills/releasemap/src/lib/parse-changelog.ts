/**
 * parse-changelog: pure-TypeScript parser for Keep a Changelog format
 * (https://keepachangelog.com).
 *
 * Handles:
 *   ## [1.2.0] - 2024-01-15
 *   ## 1.2.0 (2024-01-15)
 *   ## v1.2.0 — 2024-01-15
 *   # Unreleased
 *
 * Returns ReleaseEntry[] sorted newest-first.
 */

import { ReleaseEntry } from "./types.js";

// ---------------------------------------------------------------------------
// Breaking change detection
// ---------------------------------------------------------------------------

const BREAKING_PATTERNS = [
  /BREAKING\s+CHANGE/i,
  /\bBREAKING\b/,
  /\[!\]/, // some changelogs use [!] for breaking
  /^#+\s+.*!.*\b(change|removed?|dropped?)/im,
  /major\s+version/i,
];

function isBreaking(text: string): boolean {
  return BREAKING_PATTERNS.some((p) => p.test(text));
}

// ---------------------------------------------------------------------------
// Section count extraction
// ---------------------------------------------------------------------------

const SECTION_PATTERNS: Record<string, RegExp> = {
  added: /^###\s+(?:Added|New|Features?)/im,
  changed: /^###\s+(?:Changed|Improved?|Updated?|Enhanced?)/im,
  fixed: /^###\s+(?:Fixed?|Bug\s*fix(?:es)?|Patched?)/im,
  removed: /^###\s+(?:Removed?|Deprecated?|Dropped?)/im,
};

function countSection(body: string, sectionRe: RegExp): number {
  const match = sectionRe.exec(body);
  if (!match) return 0;

  const start = match.index + match[0].length;
  // Find next ### header
  const nextHeader = /^###\s+/m.exec(body.slice(start));
  const sectionText = nextHeader
    ? body.slice(start, start + nextHeader.index)
    : body.slice(start);

  // Count bullet points
  return (sectionText.match(/^\s*[-*+]\s+/gm) ?? []).length;
}

// ---------------------------------------------------------------------------
// Version header patterns
// ---------------------------------------------------------------------------

const VERSION_HEADER_RE =
  /^##\s+(?:\[)?v?([\d]+\.[\d]+\.[\d]+(?:-[\w.]+)?)(?:\])?\s*[-–—(]?\s*(\d{4}-\d{2}-\d{2})?/m;

const UNRELEASED_RE = /^##\s+\[?Unreleased\]?/im;

// ---------------------------------------------------------------------------
// Public parser
// ---------------------------------------------------------------------------

export function parseChangelog(text: string): ReleaseEntry[] {
  const lines = text.split(/\r?\n/);
  const releases: ReleaseEntry[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;

    // Skip Unreleased sections
    if (UNRELEASED_RE.test(line)) {
      i++;
      // skip until next ## header
      while (i < lines.length && !/^##\s+/.test(lines[i]!)) i++;
      continue;
    }

    // Version header
    const vMatch = VERSION_HEADER_RE.exec(line);
    if (vMatch) {
      const version = vMatch[1]!;
      const date = vMatch[2] ?? null;

      // Collect body until next ## header
      i++;
      const bodyLines: string[] = [];
      while (i < lines.length && !/^##\s+/.test(lines[i]!)) {
        bodyLines.push(lines[i]!);
        i++;
      }
      const body = bodyLines.join("\n");

      // Extract one-line summary: first non-empty line that isn't a ### header
      let summary = "";
      for (const bl of bodyLines) {
        const trimmed = bl.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          // Strip leading bullet/dash
          summary = trimmed.replace(/^[-*+]\s+/, "").slice(0, 120);
          break;
        }
      }

      const added = countSection(body, SECTION_PATTERNS.added!);
      const changed = countSection(body, SECTION_PATTERNS.changed!);
      const fixed = countSection(body, SECTION_PATTERNS.fixed!);
      const removed = countSection(body, SECTION_PATTERNS.removed!);

      releases.push({
        version,
        date,
        breaking: isBreaking(body),
        summary,
        added,
        changed,
        fixed,
        removed,
        body,
      });
      continue;
    }

    i++;
  }

  return releases;
}
