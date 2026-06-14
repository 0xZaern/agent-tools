/**
 * cycles: detect circular dependency chains in the import graph using DFS.
 */

import { Cycle } from "./types.js";

/**
 * Find all simple cycles in a directed graph represented as an adjacency list.
 * Uses iterative DFS to avoid stack overflow on large graphs.
 */
export function findCycles(adjacency: Map<string, string[]>): Cycle[] {
  const cycles: Cycle[] = [];
  const visited = new Set<string>();
  const seen = new Set<string>(); // global dedup of cycle signatures

  for (const start of adjacency.keys()) {
    if (visited.has(start)) continue;

    // DFS using explicit stack: [node, path]
    const stack: Array<[string, string[]]> = [[start, [start]]];

    while (stack.length > 0) {
      const top = stack.pop();
      if (!top) continue;
      const [node, currentPath] = top;

      const neighbors = adjacency.get(node) ?? [];

      for (const neighbor of neighbors) {
        // Cycle detected: neighbor is already in the current path
        const cycleStart = currentPath.indexOf(neighbor);
        if (cycleStart !== -1) {
          const cycle = currentPath.slice(cycleStart);
          // Normalize the cycle to a canonical form for dedup
          const minIdx = cycle.indexOf(cycle.reduce((a, b) => (a < b ? a : b)));
          const normalized = [...cycle.slice(minIdx), ...cycle.slice(0, minIdx)];
          const sig = normalized.join(" -> ");

          if (!seen.has(sig)) {
            seen.add(sig);
            cycles.push({ files: [...normalized, normalized[0]!] }); // close the loop
          }
          continue;
        }

        if (!visited.has(neighbor)) {
          stack.push([neighbor, [...currentPath, neighbor]]);
        }
      }
    }

    visited.add(start);
  }

  return cycles.slice(0, 50); // cap at 50 cycles to avoid huge output
}
