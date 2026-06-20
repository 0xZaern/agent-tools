import { CoverGapDigest } from "../types.js";

export function formatJson(digest: CoverGapDigest): string {
  return JSON.stringify(digest);
}
