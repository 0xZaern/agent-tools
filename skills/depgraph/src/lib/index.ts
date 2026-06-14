/**
 * depgraph — public library entry point.
 *
 * Usage:
 *   import { getDepGraph } from 'depgraph';
 *   const digest = await getDepGraph('./my-project');
 */

export { getDepGraph } from "./digest.js";
export { formatJson, formatMarkdown, formatText } from "./format/index.js";
export type {
  DepGraphDigest,
  DepGraphOptions,
  DepGraphStats,
  FileNode,
  ImportEdge,
  ExportEntry,
  Cycle,
} from "./types.js";
