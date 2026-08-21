import { flatten } from '@/merge/flatten';

describe('flatten', () => {
  it('flattens nested object to dotted keys', () => {
    const result = flatten({ foo: { bar: 123 } });

    expect(result.get('foo.bar')).toBe(123);
    expect(result.size).toBe(1);
  });

  it('flattens multiple top-level keys', () => {
    const result = flatten({ a: 1, b: 2 });

    expect(result.get('a')).toBe(1);
    expect(result.get('b')).toBe(2);
  });

  it('flattens deeply nested objects', () => {
    const result = flatten({ a: { b: { c: { d: 42 } } } });

    expect(result.get('a.b.c.d')).toBe(42);
  });

  it('treats arrays as leaf values', () => {
    const result = flatten({ items: [1, 2, 3] });

    expect(result.get('items')).toEqual([1, 2, 3]);
    expect(result.size).toBe(1);
  });

  it.each([
    { name: 'null', value: null },
    { name: 'undefined', value: undefined },
  ])('treats $name as leaf value', ({ value }) => {
    const result = flatten({ foo: value });

    expect(result.get('foo')).toBe(value);
  });

  it('treats nested arrays as leaf values', () => {
    const result = flatten({ config: { items: [1, 2] } });

    expect(result.get('config.items')).toEqual([1, 2]);
  });

  it('handles empty object', () => {
    const result = flatten({});

    expect(result.size).toBe(0);
  });

  it('handles mixed nested and scalar keys', () => {
    const result = flatten({
      scalar: 1,
      nested: { inner: 2 },
      array: [3, 4],
    });

    expect(result.get('scalar')).toBe(1);
    expect(result.get('nested.inner')).toBe(2);
    expect(result.get('array')).toEqual([3, 4]);
  });

  it('handles boolean and number leaf values', () => {
    const result = flatten({ flag: true, count: 42 });

    expect(result.get('flag')).toBe(true);
    expect(result.get('count')).toBe(42);
  });
});
