import { deepFreeze } from '@/utils/deep-freeze';

describe('deepFreeze', () => {
  it('freezes a plain object', () => {
    const object = { foo: 'bar' };

    const result = deepFreeze(object);

    expect(Object.isFrozen(result)).toBe(true);
  });

  it('returns the same object reference', () => {
    const object = { foo: 'bar' };

    const result = deepFreeze(object);

    expect(result).toBe(object);
  });

  it('deep freezes nested objects', () => {
    const object = { a: { b: { c: 1 } } };

    const result = deepFreeze(object);

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result['a'])).toBe(true);
    expect(Object.isFrozen((result['a'] as Record<string, unknown>)['b'])).toBe(
      true,
    );
  });

  it('freezes arrays recursively', () => {
    const object = { items: [1, 2, 3] };

    const result = deepFreeze(object);

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result['items'])).toBe(true);
  });

  it('does not freeze null values', () => {
    const object = { foo: null };

    const result = deepFreeze(object);

    expect(result['foo']).toBe(null);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('does not freeze primitive values', () => {
    const object = { num: 42, str: 'hello', bool: true };

    const result = deepFreeze(object);

    expect(result['num']).toBe(42);
    expect(result['str']).toBe('hello');
    expect(result['bool']).toBe(true);
  });

  it('does not freeze function values', () => {
    const function_ = (): void => {};
    const object = { callback: function_ };

    const result = deepFreeze(object);

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result['callback'])).toBe(false);
  });

  it('does not re-freeze already frozen nested objects', () => {
    const frozenInner = Object.freeze({ deep: true });
    const object = { nested: frozenInner };

    const result = deepFreeze(object);

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result['nested'])).toBe(true);
    expect(result['nested']).toBe(frozenInner);
  });

  it('handles circular references without throwing', () => {
    const object: Record<string, unknown> = { foo: 'bar' };
    object['self'] = object;

    const result = deepFreeze(object);

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result['self'])).toBe(true);
  });

  it('handles empty object', () => {
    const object = {};

    const result = deepFreeze(object);

    expect(result).toEqual({});
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('handles undefined values in object', () => {
    const object = { foo: undefined };

    const result = deepFreeze(object);

    expect(result['foo']).toBe(undefined);
    expect(Object.isFrozen(result)).toBe(true);
  });
});
