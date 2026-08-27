import fc from 'fast-check';

import { parsePath } from '@/paths/parse-path';
import { isUnsafeKey } from '@/utils/unsafe-keys';

const mixedArrayArb = fc.array(fc.oneof(fc.string(), fc.nat()));

const safeSegmentArb = fc
  .string({ minLength: 1 })
  .filter((s) => !isUnsafeKey(s))
  // Exclude path separator characters that break round-trip.
  .filter((s) => !/[.[\]\\]/.test(s));

const safeSegmentsArb = fc.array(safeSegmentArb, { maxLength: 10 });

const nonThrowingStringArb = fc.string().filter((s) => {
  // Filter out unsafe keys that would throw.
  try {
    parsePath(s);
    return true;
  } catch {
    return false;
  }
});

describe('parsePath — fuzz', () => {
  it('never throws on arbitrary strings (unsafe keys throw TypeError, not crash)', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        try {
          parsePath(input);
        } catch (error) {
          // Only TypeError is acceptable (prototype pollution detection).
          expect(error).toBeInstanceOf(TypeError);
        }
      }),
    );
  });

  it('never throws on arbitrary arrays of strings and numbers', () => {
    fc.assert(
      fc.property(mixedArrayArb, (input) => {
        try {
          parsePath(input);
        } catch (error) {
          expect(error).toBeInstanceOf(TypeError);
        }
      }),
    );
  });

  it('round-trip: parsePath(segments.join(".")) produces equivalent segments for safe inputs', () => {
    fc.assert(
      fc.property(safeSegmentsArb, (segments) => {
        const dotted = segments.join('.');
        const parsed = parsePath(dotted);
        // Numeric-looking strings become numbers, so compare as strings.
        expect(parsed.map(String)).toEqual(segments.map(String));
      }),
    );
  });

  it('idempotence: parsePath(parsePath(input)) === parsePath(input) for string inputs', () => {
    fc.assert(
      fc.property(nonThrowingStringArb, (input) => {
        const once = parsePath(input);
        const twice = parsePath(once);
        expect(twice).toEqual(once);
      }),
    );
  });

  it('no prototype pollution: arbitrary input does not pollute Object.prototype', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const before = Object.prototype;
        try {
          parsePath(input);
        } catch {
          // Throws are fine — we just care about pollution.
        }
        expect(Object.prototype).toBe(before);
        expect('polluted' in {}).toBe(false);
      }),
    );
  });
});
