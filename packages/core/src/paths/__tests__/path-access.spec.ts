vi.mock('@/paths/parse-path', async () => {
  const actual =
    await vi.importActual<typeof import('@/paths/parse-path')>(
      '@/paths/parse-path',
    );
  return {
    parsePath: vi.fn(actual.parsePath),
    validatePath: vi.fn(actual.validatePath),
  };
});

vi.mock('@/merge/merge-helpers', async () => {
  const actual = await vi.importActual<typeof import('@/merge/merge-helpers')>(
    '@/merge/merge-helpers',
  );
  return { isPlainObject: vi.fn(actual.isPlainObject) };
});

import { getPathValue } from '@/paths/path-access';

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

  it.each([
    { key: '__proto__', label: '__proto__' },
    { key: 'constructor', label: 'constructor' },
    { key: 'prototype', label: 'prototype' },
  ])('throws TypeError on array path containing $label', ({ key }) => {
    expect(() => getPathValue({}, [key])).toThrow(TypeError);
  });
});
