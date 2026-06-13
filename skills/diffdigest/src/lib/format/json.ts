import { DiffDigest } from "../types.js";

export function formatJson(digest: DiffDigest): string {
  return JSON.stringify(digest);
}
