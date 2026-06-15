import { ReleaseMapDigest } from "../types.js";

export function formatJson(digest: ReleaseMapDigest): string {
  return JSON.stringify(digest);
}
