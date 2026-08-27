import fc from 'fast-check';

import { dotifyObject } from '@/paths/dotify';
import { getPathValue } from '@/paths/path-access';
import { isUnsafeKey } from '@/utils/unsafe-keys';

const safeKey = fc.string({ minLength: 1 }).filter((s) => !isUnsafeKey(s));

/**
 * Check that no key in a nested structure contains path separator
 * characters or numeric strings that break round-trip via parsePath.
 */
function hasSafeKeys(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every((item) => hasSafeKeys(item));
  }
  const record = value as Record<string, unknown>;
  return Object.keys(record).every((key) => {
    if (/[.[\]\\]/.test(key) || /^\d+$/.test(key)) return false;
    return hasSafeKeys(record[key]);
  });
}

/**
 * Recursive arbitrary for nested objects and arrays (depth ≤ 5).
 */
function nestedArb(maxDepth: number): fc.Arbitrary<unknown> {
  const leaf = fc.oneof(fc.string(), fc.nat(), fc.boolean(), fc.constant(null));

  if (maxDepth <= 0) {
    return leaf;
  }

  const object = fc
    .array(fc.tuple(safeKey, nestedArb(maxDepth - 1)), { maxLength: 5 })
    .map((entries) => Object.fromEntries(entries));

  const array = fc.array(nestedArb(maxDepth - 1), { maxLength: 5 });

  return fc.oneof(leaf, object, array);
}

const safeNestedArb = nestedArb(4)
  .filter((v) => v !== null && typeof v === 'object')
  .filter((v) => hasSafeKeys(v));

describe('dotifyObject — fuzz', () => {
  it('never throws on arbitrary nested structures (depth ≤ 5)', () => {
    fc.assert(
      fc.property(nestedArb(5), (input) => {
        expect(() => dotifyObject(input)).not.toThrow();
      }),
    );
  });

  it('never cycles infinitely (fc.assert timeout catches infinite loops)', () => {
    fc.assert(
      fc.property(nestedArb(3), (input) => {
        // If dotifyObject loops, fc.assert will timeout.
        dotifyObject(input);
        expect(true).toBe(true);
      }),
    );
  });

  it('round-trip via getPathValue: each dotted key resolves to the same value', () => {
    fc.assert(
      fc.property(safeNestedArb, (input) => {
        const flat = dotifyObject(input);
        for (const [dotted, value] of Object.entries(flat)) {
          const resolved = getPathValue(input, dotted);
          expect(resolved).toEqual(value);
        }
      }),
    );
  });

  it('empty objects and arrays preserved', () => {
    expect(dotifyObject({ a: {} })).toEqual({ a: {} });
    expect(dotifyObject({ a: [] })).toEqual({ a: [] });
  });
});
