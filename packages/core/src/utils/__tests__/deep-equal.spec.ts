import { isDeepEqual } from '@/utils/deep-equal';

describe('isDeepEqual', () => {
  it('primitives: equal values', () => {
    expect(isDeepEqual(1, 1)).toBe(true);
    expect(isDeepEqual('a', 'a')).toBe(true);
    expect(isDeepEqual(true, true)).toBe(true);
    expect(isDeepEqual(null, null)).toBe(true);
    expect(isDeepEqual(undefined, undefined)).toBe(true);
  });

  it('primitives: unequal values', () => {
    expect(isDeepEqual(1, 2)).toBe(false);
    expect(isDeepEqual('a', 'b')).toBe(false);
    expect(isDeepEqual(true, false)).toBe(false);
    expect(isDeepEqual(1, '1')).toBe(false);
    expect(isDeepEqual(null, undefined)).toBe(false);
  });

  it('NaN via Object.is', () => {
    expect(isDeepEqual(NaN, NaN)).toBe(true);
  });

  it('+0 and -0 via Object.is', () => {
    expect(isDeepEqual(0, -0)).toBe(false);
  });

  it('plain objects: equal', () => {
    expect(isDeepEqual({ a: 1 }, { a: 1 })).toBe(true);
    expect(isDeepEqual({ a: { b: 2 } }, { a: { b: 2 } })).toBe(true);
  });

  it('plain objects: unequal values', () => {
    expect(isDeepEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(isDeepEqual({ a: { b: 2 } }, { a: { b: 3 } })).toBe(false);
  });

  it('plain objects: unequal keys', () => {
    expect(isDeepEqual({ a: 1 }, { b: 1 })).toBe(false);
    expect(isDeepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it('arrays: equal', () => {
    expect(isDeepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(isDeepEqual([{ a: 1 }], [{ a: 1 }])).toBe(true);
  });

  it('arrays: unequal', () => {
    expect(isDeepEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(isDeepEqual([1, 2], [2, 1])).toBe(false);
  });

  it('array vs object: unequal', () => {
    expect(isDeepEqual([1, 2], { 0: 1, 1: 2 })).toBe(false);
  });

  it('nested mixed structures', () => {
    expect(
      isDeepEqual({ a: [1, { b: 2 }], c: 'x' }, { a: [1, { b: 2 }], c: 'x' }),
    ).toBe(true);
    expect(
      isDeepEqual({ a: [1, { b: 2 }], c: 'x' }, { a: [1, { b: 3 }], c: 'x' }),
    ).toBe(false);
  });

  it('Date: returns false (non-plain object)', () => {
    expect(isDeepEqual(new Date(2020), new Date(2020))).toBe(false);
    expect(isDeepEqual(new Date(2020), new Date(2021))).toBe(false);
  });

  it('Map: returns false (non-plain object)', () => {
    const a = new Map([['x', 1]]);
    const b = new Map([['x', 1]]);
    expect(isDeepEqual(a, b)).toBe(false);
  });

  it('Set: returns false (non-plain object)', () => {
    expect(isDeepEqual(new Set([1, 2]), new Set([1, 2]))).toBe(false);
  });

  it('RegExp: returns false (non-plain object)', () => {
    expect(isDeepEqual(/abc/, /abc/)).toBe(false);
  });

  it('Error: returns false (non-plain object)', () => {
    expect(isDeepEqual(new Error('x'), new Error('x'))).toBe(false);
  });

  it('custom class instance: returns false', () => {
    class Foo {
      constructor(public x: number) {}
    }
    expect(isDeepEqual(new Foo(1), new Foo(1))).toBe(false);
  });

  it('non-plain object vs plain object: returns false (guard a)', () => {
    expect(isDeepEqual(new Date(2020), { x: 1 })).toBe(false);
    expect(isDeepEqual(new Map(), { x: 1 })).toBe(false);
  });

  it('empty objects and arrays', () => {
    expect(isDeepEqual({}, {})).toBe(true);
    expect(isDeepEqual([], [])).toBe(true);
    expect(isDeepEqual({}, [])).toBe(false);
  });

  it('null vs object: returns false without throwing', () => {
    expect(isDeepEqual(null, { a: 1 })).toBe(false);
    expect(isDeepEqual({ a: 1 }, null)).toBe(false);
  });

  it('undefined vs object: returns false without throwing', () => {
    expect(isDeepEqual(undefined, { a: 1 })).toBe(false);
    expect(isDeepEqual({ a: 1 }, undefined)).toBe(false);
  });
});
