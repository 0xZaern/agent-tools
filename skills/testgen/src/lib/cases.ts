/**
 * cases: generate edge-case test bodies for a function signature.
 *
 * For each parameter, generates test cases based on its type:
 *   - null / undefined
 *   - empty (empty string, empty array, empty object)
 *   - boundary (0, -1, Number.MAX_SAFE_INTEGER, very long string)
 *   - type-mismatch (pass wrong type)
 *   - happy-path (reasonable valid input)
 *   - error (expect throws)
 *
 * Each case is a small self-contained test body string.
 */

import { FunctionParam, FunctionSignature, TestCase, TestFramework } from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nullValue(type: string): string {
  if (type.includes("string")) return '""';
  if (type.includes("number")) return "0";
  if (type.includes("boolean")) return "false";
  if (type.includes("[]") || type.includes("Array")) return "[]";
  return "null";
}

function undefinedArgs(params: FunctionParam[]): string {
  return params.map(() => "undefined").join(", ");
}

function validValue(param: FunctionParam): string {
  const t = param.type.toLowerCase();
  if (t.includes("string")) return '"test"';
  if (t.includes("number") || t.includes("int") || t.includes("float")) return "1";
  if (t.includes("boolean") || t.includes("bool")) return "true";
  if (t.includes("[]") || t.startsWith("array")) return "[]";
  if (t.includes("record") || t.includes("object") || t === "{}") return "{}";
  if (t === "any" || t === "unknown") return '"test"';
  if (t === "never") return "undefined as never";
  if (param.optional && param.defaultValue) return param.defaultValue;
  return "undefined";
}

function wrongTypeValue(param: FunctionParam): string {
  const t = param.type.toLowerCase();
  if (t.includes("string")) return "42";
  if (t.includes("number")) return '"not-a-number"';
  if (t.includes("boolean")) return "42";
  if (t.includes("[]") || t.includes("array")) return '"not-an-array"';
  return "null";
}

function happyArgs(params: FunctionParam[]): string {
  return params.map((p) => validValue(p)).join(", ");
}

// ---------------------------------------------------------------------------
// Framework-specific wrappers
// ---------------------------------------------------------------------------

function itBlock(
  framework: TestFramework,
  desc: string,
  body: string,
  isAsync: boolean
): string {
  const asyncKw = isAsync ? "async " : "";
  return `  it('${desc}', ${asyncKw}() => {\n${body}\n  });`;
}

function expectThrows(
  framework: TestFramework,
  call: string,
  isAsync: boolean
): string {
  if (isAsync) {
    return `    await expect(${call}).rejects.toThrow();`;
  }
  return `    expect(() => ${call}).toThrow();`;
}

// ---------------------------------------------------------------------------
// Case generators
// ---------------------------------------------------------------------------

function genHappyPath(
  sig: FunctionSignature,
  framework: TestFramework
): TestCase {
  const args = happyArgs(sig.params);
  const call = `${sig.name}(${args})`;
  const awaitKw = sig.async ? "await " : "";
  const body = `    const result = ${awaitKw}${call};\n    expect(result).toBeDefined();`;
  return {
    description: `${sig.name}() returns a result for valid input`,
    category: "happy-path",
    body: itBlock(framework, `${sig.name}() returns a result for valid input`, body, sig.async),
  };
}

function genNullArgs(
  sig: FunctionSignature,
  framework: TestFramework
): TestCase[] {
  if (sig.params.length === 0) return [];

  return sig.params
    .filter((p) => !p.optional)
    .slice(0, 3) // cap at 3 params to avoid explosion
    .map((param) => {
      const args = sig.params
        .map((p) => (p.name === param.name ? "null" : validValue(p)))
        .join(", ");
      const call = `${sig.name}(${args} as never)`;
      const awaitKw = sig.async ? "await " : "";
      const body = expectThrows(framework, `${awaitKw}${call}`, false);
      return {
        description: `${sig.name}() throws or handles null ${param.name}`,
        category: "null" as const,
        body: itBlock(
          framework,
          `${sig.name}() throws or handles null ${param.name}`,
          `    // @ts-expect-error intentional null\n${body}`,
          false
        ),
      };
    });
}

function genUndefinedArgs(
  sig: FunctionSignature,
  framework: TestFramework
): TestCase[] {
  if (sig.params.length === 0) return [];

  const requiredParams = sig.params.filter((p) => !p.optional);
  if (requiredParams.length === 0) return [];

  const args = undefinedArgs(sig.params);
  const call = `${sig.name}(${args} as never)`;
  const awaitKw = sig.async ? "await " : "";
  const body = expectThrows(framework, `${awaitKw}${call}`, false);

  return [
    {
      description: `${sig.name}() handles all-undefined args`,
      category: "undefined",
      body: itBlock(
        framework,
        `${sig.name}() handles all-undefined args`,
        `    // @ts-expect-error intentional undefined\n${body}`,
        false
      ),
    },
  ];
}

function genEmptyArgs(
  sig: FunctionSignature,
  framework: TestFramework
): TestCase[] {
  const stringParams = sig.params.filter((p) => p.type.toLowerCase().includes("string"));
  const arrayParams = sig.params.filter(
    (p) => p.type.includes("[]") || p.type.toLowerCase().includes("array")
  );

  const cases: TestCase[] = [];

  for (const param of stringParams.slice(0, 2)) {
    const args = sig.params
      .map((p) => (p.name === param.name ? '""' : validValue(p)))
      .join(", ");
    const awaitKw = sig.async ? "await " : "";
    const body = `    const result = ${awaitKw}${sig.name}(${args});\n    expect(result).toBeDefined();`;
    cases.push({
      description: `${sig.name}() handles empty string for ${param.name}`,
      category: "empty",
      body: itBlock(
        framework,
        `${sig.name}() handles empty string for ${param.name}`,
        body,
        sig.async
      ),
    });
  }

  for (const param of arrayParams.slice(0, 1)) {
    const args = sig.params
      .map((p) => (p.name === param.name ? "[]" : validValue(p)))
      .join(", ");
    const awaitKw = sig.async ? "await " : "";
    const body = `    const result = ${awaitKw}${sig.name}(${args});\n    expect(result).toBeDefined();`;
    cases.push({
      description: `${sig.name}() handles empty array for ${param.name}`,
      category: "empty",
      body: itBlock(
        framework,
        `${sig.name}() handles empty array for ${param.name}`,
        body,
        sig.async
      ),
    });
  }

  return cases;
}

function genBoundary(
  sig: FunctionSignature,
  framework: TestFramework
): TestCase[] {
  const numberParams = sig.params.filter((p) => {
    const t = p.type.toLowerCase();
    return t.includes("number") || t.includes("int") || t.includes("float");
  });

  const cases: TestCase[] = [];

  for (const param of numberParams.slice(0, 2)) {
    for (const [label, val] of [
      ["zero", "0"],
      ["negative", "-1"],
      ["max safe integer", "Number.MAX_SAFE_INTEGER"],
    ] as [string, string][]) {
      const args = sig.params
        .map((p) => (p.name === param.name ? val : validValue(p)))
        .join(", ");
      const awaitKw = sig.async ? "await " : "";
      const body = `    const result = ${awaitKw}${sig.name}(${args});\n    expect(result).toBeDefined();`;
      cases.push({
        description: `${sig.name}() handles ${label} for ${param.name}`,
        category: "boundary",
        body: itBlock(
          framework,
          `${sig.name}() handles ${label} for ${param.name}`,
          body,
          sig.async
        ),
      });
    }
  }

  // Very long string
  const stringParams = sig.params.filter((p) => p.type.toLowerCase().includes("string"));
  for (const param of stringParams.slice(0, 1)) {
    const args = sig.params
      .map((p) => (p.name === param.name ? '"a".repeat(10000)' : validValue(p)))
      .join(", ");
    const awaitKw = sig.async ? "await " : "";
    const body = `    const result = ${awaitKw}${sig.name}(${args});\n    expect(result).toBeDefined();`;
    cases.push({
      description: `${sig.name}() handles very long string for ${param.name}`,
      category: "boundary",
      body: itBlock(
        framework,
        `${sig.name}() handles very long string for ${param.name}`,
        body,
        sig.async
      ),
    });
  }

  return cases;
}

function genTypeMismatch(
  sig: FunctionSignature,
  framework: TestFramework
): TestCase[] {
  if (sig.params.length === 0) return [];

  return sig.params
    .filter((p) => !p.optional)
    .slice(0, 2)
    .map((param) => {
      const args = sig.params
        .map((p) => (p.name === param.name ? wrongTypeValue(param) : validValue(p)))
        .join(", ");
      const call = `${sig.name}(${args} as never)`;
      const awaitKw = sig.async ? "await " : "";
      const body = expectThrows(framework, `${awaitKw}${call}`, false);
      return {
        description: `${sig.name}() handles wrong type for ${param.name}`,
        category: "type-mismatch" as const,
        body: itBlock(
          framework,
          `${sig.name}() handles wrong type for ${param.name}`,
          `    // @ts-expect-error intentional type mismatch\n${body}`,
          false
        ),
      };
    });
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

export function generateCases(
  sig: FunctionSignature,
  framework: TestFramework
): TestCase[] {
  const cases: TestCase[] = [genHappyPath(sig, framework)];

  cases.push(...genNullArgs(sig, framework));
  cases.push(...genUndefinedArgs(sig, framework));
  cases.push(...genEmptyArgs(sig, framework));
  cases.push(...genBoundary(sig, framework));
  cases.push(...genTypeMismatch(sig, framework));

  return cases.slice(0, 20); // cap at 20 cases per function
}
