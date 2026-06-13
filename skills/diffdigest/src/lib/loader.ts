/**
 * loader: resolves the diff text from three possible sources:
 *  1. Local file path (*.diff, *.patch, or any file)
 *  2. GitHub PR URL (https://github.com/owner/repo/pull/N)
 *  3. stdin (when source is null or "-")
 *
 * Returns raw unified diff text.
 */

import fs from "node:fs";

// ---------------------------------------------------------------------------
// GitHub PR loader
// ---------------------------------------------------------------------------

const GITHUB_PR_RE =
  /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/;

async function loadGithubPr(url: string, token?: string): Promise<string> {
  const m = GITHUB_PR_RE.exec(url);
  if (!m) throw new Error(`Cannot parse GitHub PR URL: ${url}`);

  const [, owner, repo, prNumber] = m;
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3.diff",
    "User-Agent": "diffdigest/1.0.0",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(apiUrl, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `GitHub API returned ${res.status} for ${apiUrl}${body ? `: ${body.slice(0, 200)}` : ""}`
    );
  }

  return res.text();
}

// ---------------------------------------------------------------------------
// Stdin
// ---------------------------------------------------------------------------

function stdinIsPiped(): boolean {
  try {
    const stat = fs.fstatSync(0);
    return stat.isFIFO() || stat.isFile();
  } catch {
    return false;
  }
}

function readStdin(): string {
  return fs.readFileSync("/dev/stdin", "utf8");
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

export interface LoadResult {
  raw: string;
  source: string;
}

export async function loadDiff(
  input: string | null,
  token?: string
): Promise<LoadResult> {
  // stdin
  if (input === null || input === "-") {
    if (!stdinIsPiped()) {
      throw new Error(
        "No input provided. Pass a file path, a GitHub PR URL, or pipe diff text via stdin."
      );
    }
    return { raw: readStdin(), source: "stdin" };
  }

  // GitHub PR URL
  if (GITHUB_PR_RE.test(input)) {
    const raw = await loadGithubPr(input, token);
    return { raw, source: "github-pr" };
  }

  // Local file
  if (!fs.existsSync(input)) {
    throw new Error(`File not found: ${input}`);
  }
  return { raw: fs.readFileSync(input, "utf8"), source: "file" };
}
