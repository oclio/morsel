import fc from 'fast-check';

import {
  getPathValue,
  hasRemovedPathValue,
  setPathValue,
} from '@/paths/path-access';
import { isUnsafeKey } from '@/utils/unsafe-keys';

/**
 * Path that starts with a string segment (target is a record, not an array)
 * and has at least one segment.
 */
const safePath = fc
  .array(
    fc.oneof(
      fc.string({ minLength: 1 }).filter((s) => !isUnsafeKey(s)),
      fc.nat(10),
    ),
    { maxLength: 20 },
  )
  .filter((p) => p.length > 0 && typeof p[0] === 'string');

const safeValue = fc.oneof(
  fc.string(),
  fc.nat(),
  fc.boolean(),
  fc.constant(null),
);

describe('setPathValue / getPathValue — fuzz', () => {
  it('get after set: getPathValue(obj, path) === value for empty object', () => {
    fc.assert(
      fc.property(safePath, safeValue, (path, value) => {
        const object: Record<string, unknown> = {};
        setPathValue(object, path, value);
        expect(getPathValue(object, path)).toEqual(value);
      }),
    );
  });

  it('get returns undefined on missing path', () => {
    fc.assert(
      fc.property(safePath, (path) => {
        expect(getPathValue({}, path)).toBeUndefined();
      }),
    );
  });

  it('set never throws on valid paths (depth limited to 20)', () => {
    fc.assert(
      fc.property(safePath, safeValue, (path, value) => {
        const object: Record<string, unknown> = {};
        expect(() => setPathValue(object, path, value)).not.toThrow();
      }),
    );
  });

  it('set does not mutate outside the path: keys outside path stay equal', () => {
    fc.assert(
      fc.property(
        safePath,
        safeValue,
        fc.string({ minLength: 1 }).filter((s) => !isUnsafeKey(s)),
        (path, value, otherKey) => {
          // Skip if otherKey collides with first path segment.
          fc.pre(path[0] !== otherKey);
          const object: Record<string, unknown> = { [otherKey]: 'untouched' };
          setPathValue(object, path, value);
          // The other key must remain untouched.
          expect(object[otherKey]).toEqual('untouched');
        },
      ),
    );
  });

  it('hasRemovedPathValue consistency: after set then remove, get returns undefined', () => {
    fc.assert(
      fc.property(safePath, safeValue, (path, value) => {
        const object: Record<string, unknown> = {};
        setPathValue(object, path, value);
        expect(getPathValue(object, path)).toEqual(value);
        hasRemovedPathValue(object, path);
        expect(getPathValue(object, path)).toBeUndefined();
      }),
    );
  });
});
