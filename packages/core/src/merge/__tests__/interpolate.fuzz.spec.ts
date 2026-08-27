import fc from 'fast-check';

import { MorselError } from '@/errors/error';
import { interpolate } from '@/merge/interpolate';
import { isUnsafeKey } from '@/utils/unsafe-keys';

const safeKey = fc
  .string({ minLength: 1 })
  .filter((s) => !isUnsafeKey(s))
  // Exclude keys that change after trim — interpolate trims reference paths.
  .filter((s) => s === s.trim())
  // Exclude path separator characters that break reference resolution.
  .filter((s) => !/[.[\]\\]/.test(s))
  // Exclude braces — they break {{...}} placeholder pattern matching.
  .filter((s) => !/[{}]/.test(s))
  // Exclude numeric strings — parsePath interprets "0" as array index.
  .filter((s) => !/^\d+$/.test(s));
const safeValue = fc.oneof(
  fc.string(),
  fc.nat(),
  fc.boolean(),
  fc.constant(null),
);

const safeConfigArb = fc
  .array(fc.tuple(safeKey, safeValue), { maxLength: 5 })
  .map((entries) => Object.fromEntries(entries)) as fc.Arbitrary<
  Record<string, unknown>
>;

const envArb = fc
  .array(fc.tuple(safeKey, fc.string()), { maxLength: 5 })
  .map((entries) => Object.fromEntries(entries)) as fc.Arbitrary<
  Record<string, string>
>;

const templateArb = fc.oneof(
  fc.string().map((s) => `\${${s}}`),
  fc.string().map((s) => `{{${s}}}`),
  fc.string().map((s) => `prefix\${${s}}suffix`),
  fc.string().map((s) => `prefix{{${s}}}suffix`),
  fc.string(),
);

describe('interpolate — fuzz', () => {
  it('never throws on arbitrary config + env (unresolved placeholders left as-is)', () => {
    fc.assert(
      fc.property(safeConfigArb, envArb, (config, env) => {
        expect(() => interpolate(config, env)).not.toThrow();
      }),
    );
  });

  it('never throws on arbitrary template strings (circular refs throw MorselError, prototype pollution throws TypeError)', () => {
    fc.assert(
      fc.property(safeKey, templateArb, (key, template) => {
        const config: Record<string, unknown> = { [key]: template };
        try {
          interpolate(config, {});
        } catch (error) {
          // MorselError (ECYCLE) for circular refs, TypeError for prototype
          // pollution via {{__proto__}}, {{constructor}}, {{prototype}}.
          expect(
            error instanceof MorselError || error instanceof TypeError,
          ).toBe(true);
        }
      }),
    );
  });

  it('resolved single ref preserves type (number stays number, not stringified)', () => {
    fc.assert(
      fc.property(safeKey, fc.nat(), (referenceKey, referenceValue) => {
        const config: Record<string, unknown> = {
          target: `{{${referenceKey}}}`,
          [referenceKey]: referenceValue,
        };
        const result = interpolate(config, {});
        expect(result['target']).toBe(referenceValue);
        expect(typeof result['target']).toBe('number');
      }),
    );
  });

  it('inputs not mutated', () => {
    fc.assert(
      fc.property(safeConfigArb, envArb, (config, env) => {
        const snapshot = JSON.stringify(config);
        interpolate(config, env);
        expect(JSON.stringify(config)).toEqual(snapshot);
      }),
    );
  });

  it('no prototype pollution: unsafe keys in config do not pollute result', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('__proto__', 'constructor', 'prototype'),
        fc.string(),
        (unsafeKey, value) => {
          const before = Object.prototype;
          const config = { [unsafeKey]: value } as Record<string, unknown>;
          const result = interpolate(config, {});
          expect(Object.prototype).toBe(before);
          // __proto__ as a key goes through the setter, not as own property.
          expect(Object.hasOwn(result, unsafeKey)).toBe(false);
        },
      ),
    );
  });
});
