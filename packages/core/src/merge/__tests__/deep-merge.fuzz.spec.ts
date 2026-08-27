import fc from 'fast-check';

import { type ArrayMergeStrategy, deepMerge } from '@/merge/deep-merge';
import { isUnsafeKey } from '@/utils/unsafe-keys';

const strategyArb = fc.constantFrom<ArrayMergeStrategy>('replace', 'concat');

const safeKey = fc.string({ minLength: 1 }).filter((s) => !isUnsafeKey(s));

/**
 * Recursive arbitrary for objects with nested arrays and objects.
 * Depth ≤ 4 to keep generated structures manageable.
 */
function nestedObjectArb(
  maxDepth: number,
): fc.Arbitrary<Record<string, unknown>> {
  const leaf = fc.oneof(fc.string(), fc.nat(), fc.boolean(), fc.constant(null));

  if (maxDepth <= 0) {
    return fc
      .array(fc.tuple(safeKey, leaf), { maxLength: 3 })
      .map((entries) => Object.fromEntries(entries));
  }

  const child = fc.oneof(
    leaf,
    fc.array(leaf, { maxLength: 3 }),
    nestedObjectArb(maxDepth - 1),
  );

  return fc
    .array(fc.tuple(safeKey, child), { maxLength: 3 })
    .map((entries) => Object.fromEntries(entries));
}

describe('deepMerge — fuzz', () => {
  it('never throws on arbitrary objects with nested arrays', () => {
    fc.assert(
      fc.property(
        nestedObjectArb(4),
        nestedObjectArb(4),
        strategyArb,
        (base, override, strategy) => {
          expect(() => deepMerge(base, override, strategy)).not.toThrow();
        },
      ),
    );
  });

  it('override wins on scalars', () => {
    const scalarArb = fc.oneof(
      fc.string(),
      fc.nat(),
      fc.boolean(),
      fc.constant(null),
    );
    fc.assert(
      fc.property(
        safeKey,
        scalarArb,
        scalarArb,
        strategyArb,
        (key, baseValue, overrideValue, strategy) => {
          const result = deepMerge(
            { [key]: baseValue },
            { [key]: overrideValue },
            strategy,
          );
          expect(result[key]).toEqual(overrideValue);
        },
      ),
    );
  });

  it('inputs not mutated', () => {
    fc.assert(
      fc.property(
        nestedObjectArb(4),
        nestedObjectArb(4),
        strategyArb,
        (base, override, strategy) => {
          const baseSnapshot = JSON.stringify(base);
          const overrideSnapshot = JSON.stringify(override);
          deepMerge(base, override, strategy);
          expect(JSON.stringify(base)).toEqual(baseSnapshot);
          expect(JSON.stringify(override)).toEqual(overrideSnapshot);
        },
      ),
    );
  });

  it('no prototype pollution: unsafe keys in base/override do not pollute result', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('__proto__', 'constructor', 'prototype'),
        fc.string(),
        strategyArb,
        (unsafeKey, value, strategy) => {
          const before = Object.prototype;
          const result = deepMerge(
            { [unsafeKey]: value } as Record<string, unknown>,
            {},
            strategy,
          );
          expect(Object.prototype).toBe(before);
          // __proto__ as a key goes through the setter, not as own property.
          // Check that the key is NOT an own property of the result.
          expect(Object.hasOwn(result, unsafeKey)).toBe(false);
        },
      ),
    );
  });
});
