/**
 * deadcode — public library entry point.
 *
 * Usage:
 *   import { getDeadCode } from 'deadcode';
 *   const digest = await getDeadCode('./my-project');
 */

export { getDeadCode } from "./digest.js";
export { formatJson, formatMarkdown, formatText } from "./format/index.js";
export type {
  DeadCodeDigest,
  DeadCodeOptions,
  DeadCodeStats,
  DeadFile,
  DeadExport,
  ExportKind,
} from "./types.js";
