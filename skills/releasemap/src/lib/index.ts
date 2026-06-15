/**
 * releasemap — public library entry point.
 *
 * Usage:
 *   import { getReleaseMap } from 'releasemap';
 *   const digest = await getReleaseMap('./CHANGELOG.md');
 *   const digest = await getReleaseMap('facebook/react');
 *   const digest = await getReleaseMap('react');
 */

export { getReleaseMap } from "./digest.js";
export { formatJson, formatMarkdown, formatText } from "./format/index.js";
export type {
  ReleaseMapDigest,
  ReleaseMapOptions,
  ReleaseMapStats,
  ReleaseEntry,
  ReleaseSource,
} from "./types.js";
