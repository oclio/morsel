import { diffKeys } from '@/merge/diff-keys';

describe('diffKeys', () => {
  it('returns empty map when old and new are identical', () => {
    const result = diffKeys({ foo: 'bar' }, { foo: 'bar' });

    expect(result.size).toBe(0);
  });

  it('detects changed scalar value', () => {
    const result = diffKeys({ foo: 'bar' }, { foo: 'baz' });

    expect(result.get('foo')).toEqual({
      next: 'baz',
      prev: 'bar',
      category: 'modified',
    });
  });

  it('detects removed key', () => {
    const result = diffKeys({ foo: 'bar' }, {});

    expect(result.get('foo')).toEqual({
      next: undefined,
      prev: 'bar',
      category: 'removed',
    });
  });

  it('emits removed key even when previous value is undefined', () => {
    const result = diffKeys({ foo: undefined }, {});

    expect(result.get('foo')).toEqual({
      next: undefined,
      prev: undefined,
      category: 'removed',
    });
  });

  it('detects added key', () => {
    const result = diffKeys({}, { foo: 'bar' });

    expect(result.get('foo')).toEqual({
      next: 'bar',
      prev: undefined,
      category: 'added',
    });
  });

  it.each([
    { name: 'number', old: { count: 42 }, new: { count: 42 } },
    { name: 'NaN', old: { val: NaN }, new: { val: NaN } },
  ])(
    'does not emit change when $name value is unchanged with Object.is',
    ({ old: oldObject, new: newObject }) => {
      const result = diffKeys(oldObject, newObject);

      expect(result.size).toBe(0);
    },
  );

  it('detects change from value to NaN', () => {
    const result = diffKeys({ val: 1 }, { val: NaN });

    expect(result.get('val')).toEqual({
      next: NaN,
      prev: 1,
      category: 'modified',
    });
  });

  it('emits parent as modified on type change from scalar to object', () => {
    const result = diffKeys({ foo: 'bar' }, { foo: { bar: 'baz' } });

    expect(result.get('foo')).toEqual({
      next: { bar: 'baz' },
      prev: 'bar',
      category: 'modified',
    });
    expect(result.get('foo.bar')).toEqual({
      next: 'baz',
      prev: undefined,
      category: 'added',
    });
  });

  it('emits parent as modified on type change from object to scalar', () => {
    const result = diffKeys({ foo: { bar: 'old' } }, { foo: 'new' });

    expect(result.get('foo')).toEqual({
      next: 'new',
      prev: { bar: 'old' },
      category: 'modified',
    });
    expect(result.get('foo.bar')).toEqual({
      next: undefined,
      prev: 'old',
      category: 'removed',
    });
  });

  it('emits parent as modified on type change from scalar to nested object', () => {
    const result = diffKeys({ a: { b: 'old' } }, { a: { b: { c: 'new' } } });

    expect(result.get('a.b')).toEqual({
      next: { c: 'new' },
      prev: 'old',
      category: 'modified',
    });
    expect(result.get('a.b.c')).toEqual({
      next: 'new',
      prev: undefined,
      category: 'added',
    });
  });

  it('emits parent as modified on type change from nested object to scalar', () => {
    const result = diffKeys({ a: { b: { c: 'old' } } }, { a: { b: 'new' } });

    expect(result.get('a.b')).toEqual({
      next: 'new',
      prev: { c: 'old' },
      category: 'modified',
    });
    expect(result.get('a.b.c')).toEqual({
      next: undefined,
      prev: 'old',
      category: 'removed',
    });
  });

  it('handles multiple changes simultaneously', () => {
    const result = diffKeys({ a: 1, b: 2, c: 3 }, { a: 1, b: 20, d: 4 });

    expect(result.size).toBe(3);
    expect(result.get('b')).toEqual({
      next: 20,
      prev: 2,
      category: 'modified',
    });
    expect(result.get('c')).toEqual({
      next: undefined,
      prev: 3,
      category: 'removed',
    });
    expect(result.get('d')).toEqual({
      next: 4,
      prev: undefined,
      category: 'added',
    });
  });

  it('detects modified nested scalar', () => {
    const result = diffKeys({ foo: { bar: 1 } }, { foo: { bar: 2 } });

    expect(result.get('foo.bar')).toEqual({
      next: 2,
      prev: 1,
      category: 'modified',
    });
    expect(result.size).toBe(1);
  });

  it('detects added nested key', () => {
    const result = diffKeys({ foo: { bar: 1 } }, { foo: { bar: 1, baz: 2 } });

    expect(result.get('foo.baz')).toEqual({
      next: 2,
      prev: undefined,
      category: 'added',
    });
    expect(result.size).toBe(1);
  });

  it('detects removed nested key', () => {
    const result = diffKeys({ foo: { bar: 1, baz: 2 } }, { foo: { bar: 1 } });

    expect(result.get('foo.baz')).toEqual({
      next: undefined,
      prev: 2,
      category: 'removed',
    });
    expect(result.size).toBe(1);
  });

  it('treats arrays as leaf values', () => {
    const result = diffKeys({ items: [1, 2] }, { items: [1, 2, 3] });

    expect(result.get('items')).toEqual({
      next: [1, 2, 3],
      prev: [1, 2],
      category: 'modified',
    });
    expect(result.size).toBe(1);
  });

  it('does not emit change when array is unchanged', () => {
    const array = [1, 2, 3];
    const result = diffKeys({ items: array }, { items: array });

    expect(result.size).toBe(0);
  });

  it('handles deep nesting', () => {
    const result = diffKeys(
      { a: { b: { c: { d: 1 } } } },
      { a: { b: { c: { d: 2 } } } },
    );

    expect(result.get('a.b.c.d')).toEqual({
      next: 2,
      prev: 1,
      category: 'modified',
    });
    expect(result.size).toBe(1);
  });

  it.each([
    {
      name: 'scalar to array',
      old: { foo: 'bar' },
      new: { foo: [1, 2] },
      expected: { next: [1, 2], prev: 'bar' },
    },
    {
      name: 'array to scalar',
      old: { foo: [1, 2] },
      new: { foo: 'bar' },
      expected: { next: 'bar', prev: [1, 2] },
    },
  ])(
    'handles type change from $name',
    ({ old: oldObject, new: newObject, expected }) => {
      const result = diffKeys(oldObject, newObject);

      expect(result.get('foo')).toEqual({
        ...expected,
        category: 'modified',
      });
      expect(result.size).toBe(1);
    },
  );

  it('emits parent as modified when scalar becomes object with nested children', () => {
    const result = diffKeys({ a: 'scalar' }, { a: { b: { c: 'deep' } } });

    expect(result.get('a')).toEqual({
      next: { b: { c: 'deep' } },
      prev: 'scalar',
      category: 'modified',
    });
    expect(result.get('a.b.c')).toEqual({
      next: 'deep',
      prev: undefined,
      category: 'added',
    });
  });

  it('emits parent as modified when nested object becomes scalar deeply', () => {
    const result = diffKeys({ a: { b: { c: 'deep' } } }, { a: 'scalar' });

    expect(result.get('a')).toEqual({
      next: 'scalar',
      prev: { b: { c: 'deep' } },
      category: 'modified',
    });
    expect(result.get('a.b.c')).toEqual({
      next: undefined,
      prev: 'deep',
      category: 'removed',
    });
  });

  it('treats literal dotted key in new as added, not as child of old scalar', () => {
    const result = diffKeys({ a: 5 }, { 'a.b': 1 });

    expect(result.get('a')).toEqual({
      next: undefined,
      prev: 5,
      category: 'removed',
    });
    expect(result.get('a.b')).toEqual({
      next: 1,
      prev: undefined,
      category: 'added',
    });
  });

  it('treats literal dotted key in old as removed, not as child of new scalar', () => {
    const result = diffKeys({ 'a.b': 1 }, { a: 5 });

    expect(result.get('a.b')).toEqual({
      next: undefined,
      prev: 1,
      category: 'removed',
    });
    expect(result.get('a')).toEqual({
      next: 5,
      prev: undefined,
      category: 'added',
    });
  });

  it('treats deep literal dotted key as added when intermediate path is scalar', () => {
    const result = diffKeys({ 'a.b': 5 }, { 'a.b.c': 1 });

    expect(result.get('a.b')).toEqual({
      next: undefined,
      prev: 5,
      category: 'removed',
    });
    expect(result.get('a.b.c')).toEqual({
      next: 1,
      prev: undefined,
      category: 'added',
    });
  });

  it('falls back to removed when intermediate path is scalar in new object', () => {
    const result = diffKeys({ a: { b: 1 } }, { a: 5, 'a.b.c': 2 });

    expect(result.get('a.b')).toEqual({
      next: undefined,
      prev: 1,
      category: 'removed',
    });
    expect(result.get('a')).toEqual({
      next: 5,
      prev: { b: 1 },
      category: 'modified',
    });
    expect(result.get('a.b.c')).toEqual({
      next: 2,
      prev: undefined,
      category: 'added',
    });
  });

  it.each([
    {
      name: 'removed side',
      old: { 'a.0': 1 },
      new: { a: [2, 3], 'a.0.x': 'val' },
      expected: { next: undefined, prev: 1, category: 'removed' as const },
    },
    {
      name: 'added side',
      old: { a: [2, 3], 'a.0.x': 'val' },
      new: { 'a.0': 1 },
      expected: { next: 1, prev: undefined, category: 'added' as const },
    },
  ])(
    'does not traverse arrays in getPath on $name',
    ({ old: oldObject, new: newObject, expected }) => {
      const result = diffKeys(oldObject, newObject);

      expect(result.get('a.0')).toEqual(expected);
    },
  );

  it('does not traverse inherited properties in getPath', () => {
    const result = diffKeys(
      { 'a.toString': 1 },
      { a: {}, 'a.toString.b': 'val' },
    );

    expect(result.get('a.toString')).toEqual({
      next: undefined,
      prev: 1,
      category: 'removed',
    });
  });

  it('emits wholly-added nested object parent as added without intermediate parents', () => {
    const result = diffKeys({}, { a: { b: { c: 1 } } });

    expect(result.get('a')).toEqual({
      next: { b: { c: 1 } },
      prev: undefined,
      category: 'added',
    });
    expect(result.has('a.b')).toBe(false);
    expect(result.get('a.b.c')).toEqual({
      next: 1,
      prev: undefined,
      category: 'added',
    });
  });

  it('emits wholly-removed nested object parent as removed without intermediate parents', () => {
    const result = diffKeys({ a: { b: { c: 1 } } }, {});

    expect(result.get('a')).toEqual({
      next: undefined,
      prev: { b: { c: 1 } },
      category: 'removed',
    });
    expect(result.has('a.b')).toBe(false);
    expect(result.get('a.b.c')).toEqual({
      next: undefined,
      prev: 1,
      category: 'removed',
    });
  });

  it('emits nested wholly-added object inside existing parent as added', () => {
    const result = diffKeys({ a: { b: 1 } }, { a: { b: 1, c: { d: 2 } } });

    expect(result.get('a.c')).toEqual({
      next: { d: 2 },
      prev: undefined,
      category: 'added',
    });
    expect(result.get('a.c.d')).toEqual({
      next: 2,
      prev: undefined,
      category: 'added',
    });
  });

  it('emits nested wholly-removed object inside existing parent as removed', () => {
    const result = diffKeys({ a: { b: 1, c: { d: 2 } } }, { a: { b: 1 } });

    expect(result.get('a.c')).toEqual({
      next: undefined,
      prev: { d: 2 },
      category: 'removed',
    });
    expect(result.get('a.c.d')).toEqual({
      next: undefined,
      prev: 2,
      category: 'removed',
    });
  });

  it.each([
    {
      name: 'added',
      old: { a: 'scalar' },
      new: { a: { b: { c: 'deep' } } },
      expected: {
        next: { c: 'deep' },
        prev: undefined,
        category: 'added' as const,
      },
    },
    {
      name: 'removed',
      old: { a: { b: { c: 'deep' } } },
      new: { a: 'scalar' },
      expected: {
        next: undefined,
        prev: { c: 'deep' },
        category: 'removed' as const,
      },
    },
  ])(
    'emits intermediate parent as $name on type change between scalar and nested object',
    ({ old: oldObject, new: newObject, expected }) => {
      const result = diffKeys(oldObject, newObject);

      expect(result.get('a.b')).toEqual(expected);
    },
  );
});
