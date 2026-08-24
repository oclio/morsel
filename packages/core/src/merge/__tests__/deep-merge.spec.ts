import { deepMerge } from '@/merge/deep-merge';

describe('deepMerge', () => {
  it('returns base when override is empty', () => {
    const result = deepMerge({ foo: 'bar' }, {}, 'replace');

    expect(result).toEqual({ foo: 'bar' });
  });

  it('returns override values when base is empty', () => {
    const result = deepMerge({}, { foo: 'bar' }, 'replace');

    expect(result).toEqual({ foo: 'bar' });
  });

  it.each([
    {
      name: 'string',
      base: { foo: 'bar' },
      override: { foo: 'baz' },
      expected: { foo: 'baz' },
    },
    {
      name: 'boolean',
      base: { flag: true },
      override: { flag: false },
      expected: { flag: false },
    },
    {
      name: 'number',
      base: { count: 10 },
      override: { count: 42 },
      expected: { count: 42 },
    },
  ])('override $name wins over base $name', ({ base, override, expected }) => {
    const result = deepMerge(base, override, 'replace');

    expect(result).toEqual(expected);
  });

  it.each([
    { name: 'scalar', base: { foo: 'bar' }, key: 'foo' },
    { name: 'object', base: { config: { a: 1 } }, key: 'config' },
    { name: 'array', base: { items: [1, 2] }, key: 'items' },
  ])('null override overwrites base $name with null', ({ base, key }) => {
    const result = deepMerge(base, { [key]: null }, 'replace');

    expect(result).toEqual({ [key]: null });
  });

  it('undefined override is ignored', () => {
    const result = deepMerge({ foo: 'bar' }, { foo: undefined }, 'replace');

    expect(result).toEqual({ foo: 'bar' });
  });

  it('recursively merges nested plain objects', () => {
    const result = deepMerge(
      { nested: { a: 1, b: 2 } },
      { nested: { b: 3, c: 4 } },
      'replace',
    );

    expect(result).toEqual({ nested: { a: 1, b: 3, c: 4 } });
  });

  it.each([
    {
      name: 'replace strategy replaces base array',
      strategy: 'replace' as const,
      base: { items: [1, 2, 3] },
      override: { items: [4, 5] },
      expected: { items: [4, 5] },
    },
    {
      name: 'concat strategy concatenates arrays',
      strategy: 'concat' as const,
      base: { items: [1, 2, 3] },
      override: { items: [4, 5] },
      expected: { items: [1, 2, 3, 4, 5] },
    },
  ])('$name', ({ base, override, strategy, expected }) => {
    const result = deepMerge(base, override, strategy);

    expect(result).toEqual(expected);
  });

  it('override array replaces base non-array value with a new array', () => {
    const overrideItems = [1, 2];
    const result = deepMerge(
      { items: 'string' },
      { items: overrideItems },
      'replace',
    );

    expect(result).toEqual({ items: [1, 2] });
    expect(result['items']).not.toBe(overrideItems);
  });

  it('override object replaces base non-object value with a new object', () => {
    const overrideConfig = { a: 1 };
    const result = deepMerge(
      { config: 'string' },
      { config: overrideConfig },
      'replace',
    );

    expect(result).toEqual({ config: { a: 1 } });
    expect(result['config']).not.toBe(overrideConfig);
  });

  it.each([
    { name: 'object', base: { config: { a: 1 } }, key: 'config' },
    { name: 'array', base: { items: [1, 2] }, key: 'items' },
  ])('override scalar replaces base $name', ({ base, key }) => {
    const result = deepMerge(base, { [key]: 'string' }, 'replace');

    expect(result).toEqual({ [key]: 'string' });
  });

  it('override array replaces base object', () => {
    const result = deepMerge({ items: { a: 1 } }, { items: [1, 2] }, 'replace');

    expect(result).toEqual({ items: [1, 2] });
  });

  it('override object replaces base array', () => {
    const result = deepMerge({ items: [1, 2] }, { items: { a: 1 } }, 'replace');

    expect(result).toEqual({ items: { a: 1 } });
  });

  it('does not mutate base or override', () => {
    const base = { foo: 'bar', nested: { a: 1 } };
    const override = { foo: 'baz', nested: { b: 2 } };

    deepMerge(base, override, 'replace');

    expect(base).toEqual({ foo: 'bar', nested: { a: 1 } });
    expect(override).toEqual({ foo: 'baz', nested: { b: 2 } });
  });

  it('merges multiple keys simultaneously', () => {
    const result = deepMerge(
      { a: 1, b: { x: 1 }, c: [1, 2] },
      { a: 2, b: { y: 2 }, c: [3] },
      'replace',
    );

    expect(result).toEqual({ a: 2, b: { x: 1, y: 2 }, c: [3] });
  });

  it('handles deeply nested objects', () => {
    const result = deepMerge(
      { a: { b: { c: { d: 1 } } } },
      { a: { b: { c: { e: 2 } } } },
      'replace',
    );

    expect(result).toEqual({ a: { b: { c: { d: 1, e: 2 } } } });
  });

  it.each([
    { name: 'object', key: 'new', value: { a: 1 } },
    { name: 'array', key: 'items', value: [1, 2] },
  ])(
    'override $name with no corresponding base key creates new $name',
    ({ key, value }) => {
      const result = deepMerge({}, { [key]: value }, 'replace');

      expect(result).toEqual({ [key]: value });
    },
  );

  it('deep-clones object elements in override-only arrays', () => {
    const item = { a: 1 };
    const result = deepMerge({}, { items: [item] }, 'replace');
    const items = result['items'] as unknown[];

    expect(items).toEqual([{ a: 1 }]);
    expect(items).not.toBe([item]);
    expect(items[0]).not.toBe(item);
  });

  it('deep-clones object elements when replacing arrays', () => {
    const overrideItem = { b: 2 };
    const result = deepMerge(
      { items: [{ a: 1 }] },
      { items: [overrideItem] },
      'replace',
    );
    const items = result['items'] as unknown[];

    expect(items).toEqual([{ b: 2 }]);
    expect(items[0]).not.toBe(overrideItem);
  });

  it('deep-clones object elements from both arrays when concatenating', () => {
    const baseItem = { a: 1 };
    const overrideItem = { b: 2 };
    const result = deepMerge(
      { items: [baseItem] },
      { items: [overrideItem] },
      'concat',
    );
    const items = result['items'] as unknown[];

    expect(items).toEqual([{ a: 1 }, { b: 2 }]);
    expect(items[0]).not.toBe(baseItem);
    expect(items[1]).not.toBe(overrideItem);
  });

  it('deep-clones nested objects inside array elements', () => {
    const item = { nested: { a: 1 } };
    const result = deepMerge({}, { items: [item] }, 'replace');
    const items = result['items'] as unknown[];
    const cloned = items[0] as { nested: { a: number } };

    expect(items[0]).not.toBe(item);
    expect(cloned.nested).not.toBe(item.nested);
  });

  it('deep-clones nested arrays inside array elements', () => {
    const item = { matrix: [[1, 2]] };
    const result = deepMerge({}, { items: [item] }, 'replace');
    const items = result['items'] as unknown[];
    const cloned = items[0] as { matrix: number[][] };
    const originalMatrix = item.matrix;

    expect(cloned.matrix).toEqual([[1, 2]]);
    expect(cloned.matrix).not.toBe(originalMatrix);
    expect(cloned.matrix[0]).not.toBe(originalMatrix[0]);
  });
});

describe('deepMerge — prototype pollution protection', () => {
  it('skips __proto__ key from override', () => {
    const malicious = JSON.parse('{"__proto__":{"polluted":true}}');
    const result = deepMerge({ foo: 'bar' }, malicious, 'replace');

    expect(result).toEqual({ foo: 'bar' });
    expect(result).not.toHaveProperty('polluted');
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('skips constructor key from override', () => {
    const result = deepMerge(
      { foo: 'bar' },
      { constructor: { prototype: { polluted: true } } } as Record<
        string,
        unknown
      >,
      'replace',
    );

    expect(result).toEqual({ foo: 'bar' });
    expect(result).not.toHaveProperty('prototype');
  });

  it('skips __proto__ key from base when spreading', () => {
    const malicious = JSON.parse('{"__proto__":{"polluted":true}}');
    const result = deepMerge(malicious, { foo: 'bar' }, 'replace');

    expect(result).not.toHaveProperty('polluted');
  });

  it('skips __proto__ in nested objects during merge', () => {
    const malicious = JSON.parse('{"nested":{"__proto__":{"polluted":true}}}');
    const result = deepMerge({ nested: {} }, malicious, 'replace');

    expect(result['nested'] as Record<string, unknown>).toEqual({});
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('skips __proto__ in deepCloneValue for arrays', () => {
    const malicious = JSON.parse('{"items":[{"__proto__":{"polluted":true}}]}');
    const result = deepMerge({}, malicious, 'replace');

    const items = result['items'] as unknown[];
    expect(items[0]).toEqual({});
    expect((items[0] as Record<string, unknown>)['polluted']).toBeUndefined();
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('skips prototype key from override', () => {
    const result = deepMerge(
      { foo: 'bar' },
      { prototype: { polluted: true } } as Record<string, unknown>,
      'replace',
    );

    expect(result).toEqual({ foo: 'bar' });
    expect(result).not.toHaveProperty('prototype');
  });

  it('skips prototype in nested objects during merge', () => {
    const result = deepMerge(
      { nested: {} },
      { nested: { prototype: { polluted: true } } } as Record<string, unknown>,
      'replace',
    );

    expect(result['nested'] as Record<string, unknown>).toEqual({});
  });

  it('skips prototype in deepCloneValue for arrays', () => {
    const result = deepMerge(
      {},
      { items: [{ prototype: { polluted: true } }] } as Record<string, unknown>,
      'replace',
    );

    const items = result['items'] as unknown[];
    expect(items[0]).toEqual({});
  });
});
