/**
 * testgen — public library entry point.
 *
 * Usage:
 *   import { getTestGen } from 'testgen';
 *   const digest = await getTestGen('./src/utils/validate.ts');
 */

export { getTestGen } from "./digest.js";
export { formatJson, formatMarkdown, formatText } from "./format/index.js";
export type {
  TestGenDigest,
  TestGenOptions,
  TestGenStats,
  FunctionTestSkeleton,
  FunctionSignature,
  FunctionParam,
  TestCase,
  TestFramework,
} from "./types.js";
