import { DepGraphDigest } from "../types.js";

export function formatJson(digest: DepGraphDigest): string {
  return JSON.stringify(digest);
}
