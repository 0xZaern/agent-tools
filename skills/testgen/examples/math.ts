/**
 * math.ts — sample input file for testgen examples.
 *
 * Run:
 *   testgen ./node_modules/testgen/examples/math.ts
 *   testgen ./node_modules/testgen/examples/math.ts --text > math.test.ts
 *   testgen ./node_modules/testgen/examples/math.ts --function clamp --md
 */

/** Clamp a number between a minimum and maximum value. */
export function clamp(value: number, min: number, max: number): number {
  if (min > max) {
    throw new RangeError(`min (${min}) must be <= max (${max})`);
  }
  return Math.min(Math.max(value, min), max);
}

/** Compute the percentage that `part` represents of `total`. */
export function percentage(part: number, total: number): number {
  if (total === 0) {
    throw new RangeError("total must not be zero");
  }
  return (part / total) * 100;
}

/**
 * Pad a number with leading zeros to a minimum width.
 * @param n      The number to pad.
 * @param width  Minimum character width (default 2).
 */
export function zeroPad(n: number, width = 2): string {
  return String(Math.floor(Math.abs(n))).padStart(width, "0");
}

/** Return true if n is an integer. */
export function isInteger(n: number): boolean {
  return Number.isInteger(n);
}

/** Sum an array of numbers. Returns 0 for an empty array. */
export function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}
