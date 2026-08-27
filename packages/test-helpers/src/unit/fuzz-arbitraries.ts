import fc from 'fast-check';

import { isUnsafeKey } from './unsafe-keys';

/**
 * Arbitrary that generates non-empty strings which are **not** prototype
 * pollution vectors (`__proto__`, `constructor`, `prototype`).
 */
export const safeStringArb = fc
  .string({ minLength: 1 })
  .filter((s) => !isUnsafeKey(s));

/**
 * Arbitrary that generates a single path segment — either a safe string or
 * a small non-negative integer (mimicking array indices).
 */
export const safeKeyArb = fc.oneof(safeStringArb, fc.nat(100));

/**
 * Arbitrary that generates an array of path segments (max depth 20 to avoid
 * stack overflow in recursive path operations).
 */
export const safePathArb = fc.array(safeKeyArb, { maxLength: 20 });

/**
 * Arbitrary that generates a string containing arbitrary `${...}` and
 * `{{...}}` placeholders for interpolation fuzzing.
 */
export const templateStringArb = fc
  .string()
  .chain((s) =>
    fc.oneof(
      fc.constant(`\${${s}}`),
      fc.constant(`{{${s}}}`),
      fc.constant(`prefix\${${s}}suffix`),
      fc.constant(`prefix{{${s}}}suffix`),
      fc.constant(s),
    ),
  );

/**
 * Arbitrary that generates a dot-path string from safe segments.
 */
export const safeDotPathArb = safePathArb.map((segments) =>
  segments.map(String).join('.'),
);

/**
 * Recursive arbitrary for JSON-like values with bounded depth.
 *
 * Includes nested objects **and** arrays to cover array/object interactions
 * in merge and dotify operations. Unsafe keys are filtered out.
 *
 * @param maxDepth - Maximum nesting depth (default 5).
 */
export function jsonArb(maxDepth = 5): fc.Arbitrary<unknown> {
  const leaf = fc.oneof(
    fc.string(),
    fc.nat(),
    fc.float(),
    fc.boolean(),
    // null is a valid JSON value — deepMerge documents "null overwrites (allows reset)"
    // vs "undefined is ignored". Both must be generated to cover distinct code paths.
    // eslint-disable-next-line unicorn/no-null
    fc.constant(null),
    fc.constant(undefined),
  );

  if (maxDepth <= 0) {
    return leaf;
  }

  const safeKey = safeStringArb;

  const objectArb = fc
    .array(fc.tuple(safeKey, jsonArb(maxDepth - 1)), { maxLength: 5 })
    .map((entries) => Object.fromEntries(entries));

  const arrayArb = fc.array(jsonArb(maxDepth - 1), { maxLength: 5 });

  return fc.oneof(leaf, objectArb, arrayArb);
}

/**
 * Arbitrary that generates a plain object (ConfigRecord-like) with safe keys
 * and bounded depth. Useful for `deepMerge` and `interpolate` fuzzing.
 */
export function safeObjectArb(
  maxDepth = 5,
): fc.Arbitrary<Record<string, unknown>> {
  return jsonArb(maxDepth).map((v) => {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      return v as Record<string, unknown>;
    }
    return { key: v };
  });
}
