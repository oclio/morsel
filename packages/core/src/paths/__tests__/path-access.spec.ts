vi.mock('@/paths/parse-path', async () => {
  const actual =
    await vi.importActual<typeof import('@/paths/parse-path')>(
      '@/paths/parse-path',
    );
  return { parsePath: vi.fn(actual.parsePath) };
});

vi.mock('@/merge/merge-helpers', async () => {
  const actual = await vi.importActual<typeof import('@/merge/merge-helpers')>(
    '@/merge/merge-helpers',
  );
  return { isPlainObject: vi.fn(actual.isPlainObject) };
});

import {
  getPathValue,
  hasRemovedPathValue,
  setPathValue,
} from '@/paths/path-access';

describe('getPathValue', () => {
  const data = {
    server: { port: 3000 },
    users: [{ name: 'Alice' }, { name: 'Bob' }],
  };

  it.each([
    { path: 'server.port', expected: 3000, label: 'nested object value' },
    {
      path: 'users[0].name',
      expected: 'Alice',
      label: 'array index via bracket',
    },
    { path: 'users.1.name', expected: 'Bob', label: 'array index via dot' },
  ])('reads $label', ({ path, expected }) => {
    expect(getPathValue(data, path)).toBe(expected);
  });

  it.each([
    {
      path: ['server', 'port'],
      expected: 3000,
      label: 'nested object via array',
    },
    {
      path: ['users', 0, 'name'],
      expected: 'Alice',
      label: 'array index via array',
    },
  ])('reads $label via segment array', ({ path, expected }) => {
    expect(getPathValue(data, path)).toBe(expected);
  });

  it.each([
    { path: 'server.host', label: 'missing key on object' },
    { path: 'users[5].name', label: 'out-of-bounds array index' },
    {
      path: ['a', 'c'],
      target: { a: { b: 1 } },
      label: 'missing key via array',
    },
    {
      path: ['users', 'foo'],
      target: { users: ['x'] },
      label: 'string segment on array',
    },
    {
      path: ['users', '0', 'name'],
      target: data,
      label: 'string "0" not normalized to number',
    },
    {
      path: ['a', 'toString'],
      target: { a: {} },
      label: 'inherited property not accessed',
    },
  ])('returns undefined for $label', ({ target: t = data, path }) => {
    expect(getPathValue(t, path)).toBeUndefined();
  });

  it.each([
    { target: { port: 3000 }, label: 'non-array object' },
    { target: { 0: 'x' }, label: 'plain object with numeric key' },
  ])(
    'returns undefined when numeric segment used on $label',
    ({ target: t }) => {
      expect(getPathValue(t, [0])).toBeUndefined();
    },
  );

  it.each([
    { value: 'hello', label: 'primitive' },
    { value: null, label: 'null' },
    { value: undefined, label: 'undefined' },
  ])('returns undefined when traversing into $label', ({ value }) => {
    expect(getPathValue({ a: value }, 'a.b')).toBeUndefined();
  });

  it('returns undefined when target is null', () => {
    expect(getPathValue(null, 'a')).toBeUndefined();
  });
});

describe('setPathValue', () => {
  it('sets value in existing object', () => {
    const data: Record<string, unknown> = { server: { port: 3000 } };
    setPathValue(data, 'server.port', 8080);
    expect(data).toEqual({ server: { port: 8080 } });
  });

  it.each([
    {
      path: 'a.b.c',
      value: 42,
      expected: { a: { b: { c: 42 } } },
      label: 'intermediate objects',
    },
    {
      path: 'users[0].name',
      value: 'Alice',
      expected: { users: [{ name: 'Alice' }] },
      label: 'intermediate arrays for numeric segments',
    },
  ])('creates $label', ({ path, value, expected }) => {
    const data: Record<string, unknown> = {};
    setPathValue(data, path, value);
    expect(data).toEqual(expected);
  });

  it.each([
    {
      path: ['a', 'b'] as const,
      value: 42,
      expected: { a: { b: 42 } },
      label: 'string segments via array',
    },
    {
      path: ['a', 0, 'b'] as const,
      value: 42,
      expected: { a: [{ b: 42 }] },
      label: 'numeric segment creates array',
    },
    {
      path: ['a', '0'] as const,
      value: 42,
      expected: { a: { '0': 42 } },
      label: 'string "0" not normalized to number',
    },
  ])('accepts $label', ({ path, value, expected }) => {
    const data: Record<string, unknown> = {};
    setPathValue(data, path, value);
    expect(data).toEqual(expected);
  });

  it.each([
    {
      initial: { a: { b: 1 } },
      path: 'a.c',
      value: 2,
      expected: { a: { b: 1, c: 2 } },
      label: 'existing intermediate object',
    },
    {
      initial: { users: [{ name: 'Alice' }] },
      path: 'users[1].name',
      value: 'Bob',
      expected: { users: [{ name: 'Alice' }, { name: 'Bob' }] },
      label: 'existing intermediate array',
    },
  ])('reuses $label', ({ initial, path, value, expected }) => {
    const data: Record<string, unknown> = initial;
    setPathValue(data, path, value);
    expect(data).toEqual(expected);
  });

  it('does not pre-fill intermediate array with stray elements', () => {
    const data: Record<string, unknown> = {};
    setPathValue(data, ['a', 1, 'b'], 42);
    expect(data).toEqual({ a: [undefined, { b: 42 }] });
  });

  it('does nothing when path has no segments', () => {
    const data: Record<string, unknown> = { a: 1 };
    setPathValue(data, [], 42);
    expect(data).toEqual({ a: 1 });
  });
});

describe('hasRemovedPathValue', () => {
  it.each([
    {
      initial: { a: { b: 1, c: 2 } },
      path: 'a.b',
      expected: { a: { c: 2 } },
      label: 'property from object',
    },
    {
      initial: { a: { b: { c: 1 } } },
      path: 'a.b.c',
      expected: { a: { b: {} } },
      label: 'deeply nested property',
    },
    {
      initial: { a: { b: 1, c: 2 } },
      path: ['a', 'b'] as const,
      expected: { a: { c: 2 } },
      label: 'property via segment array',
    },
    {
      initial: { a: { '0': 1 } },
      path: ['a', '0'] as const,
      expected: { a: {} },
      label: 'string numeric segment not normalized',
    },
  ])('removes $label', ({ initial, path, expected }) => {
    const data: Record<string, unknown> = initial;
    expect(hasRemovedPathValue(data, path)).toBe(true);
    expect(data).toEqual(expected);
  });

  it.each([
    {
      initial: { users: ['Alice', 'Bob', 'Charlie'] },
      path: 'users[1]',
      expected: { users: ['Alice', 'Charlie'] },
      label: 'middle element',
    },
    {
      initial: { users: ['Alice', 'Bob'] },
      path: 'users[0]',
      expected: { users: ['Bob'] },
      label: 'first element',
    },
  ])('splices $label from array', ({ initial, path, expected }) => {
    const data: Record<string, unknown> = initial;
    expect(hasRemovedPathValue(data, path)).toBe(true);
    expect(data).toEqual(expected);
  });

  it('fully deletes property from object', () => {
    const data: Record<string, unknown> = { a: { b: 1 } };
    hasRemovedPathValue(data, 'a.b');
    expect(Object.hasOwn(data['a'] as object, 'b')).toBe(false);
  });

  it.each([
    { initial: { a: 1 }, path: 'b.c', label: 'key does not exist' },
    {
      initial: { a: {} },
      path: 'a.b',
      label: 'key does not exist on parent object',
    },
    {
      initial: { a: 'string' },
      path: 'a.b',
      label: 'parent is neither object nor array',
    },
    { initial: { a: null }, path: 'a.b', label: 'parent is null' },
    { initial: { a: undefined }, path: 'a.b', label: 'parent is undefined' },
    { initial: { a: 1 }, path: [] as never, label: 'path has no segments' },
    {
      initial: { users: ['Alice', 'Bob'] },
      path: ['users', '0'],
      label: 'string segment on array via array path',
    },
    {
      initial: { users: ['Alice', 'Bob'] },
      path: ['users', -1],
      label: 'negative array index',
    },
    {
      initial: { users: ['Alice', 'Bob'] },
      path: ['users', 2],
      label: 'index equals array length',
    },
    {
      initial: { users: ['Alice'] },
      path: 'users[5]',
      label: 'out-of-bounds array index',
    },
    {
      initial: { a: { 0: 'x' } },
      path: ['a', 0],
      label: 'numeric segment on plain object',
    },
  ])('returns false when $label', ({ initial, path }) => {
    const data: Record<string, unknown> = initial;
    expect(hasRemovedPathValue(data, path)).toBe(false);
  });
});
