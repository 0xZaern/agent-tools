/**
 * diffdigest — public library entry point.
 *
 * Usage:
 *   import { getDiffDigest } from 'diffdigest';
 *   const digest = await getDiffDigest('./my.diff');
 */

export { getDiffDigest } from "./digest.js";
export { formatJson, formatMarkdown, formatText } from "./format/index.js";
export type {
  DiffDigest,
  DiffDigestOptions,
  DiffDigestStats,
  FileChange,
  FileChangeType,
  HunkSummary,
  RiskSignals,
} from "./types.js";
