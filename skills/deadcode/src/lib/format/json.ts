import { DeadCodeDigest } from "../types.js";

export function formatJson(digest: DeadCodeDigest): string {
  return JSON.stringify(digest);
}
