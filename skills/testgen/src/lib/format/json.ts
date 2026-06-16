import { TestGenDigest } from "../types.js";

export function formatJson(digest: TestGenDigest): string {
  return JSON.stringify(digest);
}
