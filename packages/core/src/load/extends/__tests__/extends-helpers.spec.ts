import { normalizeExtends, stripExtends } from '@/load/extends/extends-helpers';

describe('stripExtends', () => {
  it.each([
    {
      name: 'removes extends key and keeps other keys',
      input: { extends: './base.json', foo: 'bar', count: 42 },
      expected: { foo: 'bar', count: 42 },
    },
    {
      name: 'returns identical config when extends is absent',
      input: { foo: 'bar', count: 42 },
      expected: { foo: 'bar', count: 42 },
    },
    {
      name: 'returns empty object when config only has extends',
      input: { extends: './base.json' },
      expected: {},
    },
    {
      name: 'handles empty config',
      input: {},
      expected: {},
    },
    {
      name: 'preserves nested objects',
      input: { extends: './base.json', nested: { a: 1, b: 2 } },
      expected: { nested: { a: 1, b: 2 } },
    },
  ])('$name', ({ input, expected }) => {
    const result = stripExtends(input);

    expect(result).toEqual(expected);
  });

  it('does not mutate the original config', () => {
    const input = { extends: './base.json', foo: 'bar' };

    stripExtends(input);

    expect(input).toEqual({ extends: './base.json', foo: 'bar' });
  });
});

describe('normalizeExtends', () => {
  it.each([
    {
      name: 'resolves a single string extends to absolute path',
      value: './base.json',
      baseDir: '/fake/dir',
      expected: ['/fake/dir/base.json'],
    },
    {
      name: 'resolves an absolute string extends as-is',
      value: '/abs/base.json',
      baseDir: '/fake/dir',
      expected: ['/abs/base.json'],
    },
    {
      name: 'resolves array of string extends to absolute paths',
      value: ['./a.json', './b.json'],
      baseDir: '/fake/dir',
      expected: ['/fake/dir/a.json', '/fake/dir/b.json'],
    },
    {
      name: 'filters out non-string entries from array',
      value: ['./a.json', 42, null, './b.json'],
      baseDir: '/fake/dir',
      expected: ['/fake/dir/a.json', '/fake/dir/b.json'],
    },
    {
      name: 'returns empty array for undefined value',
      value: undefined,
      baseDir: '/fake/dir',
      expected: [],
    },
    {
      name: 'returns empty array for null value',
      value: null,
      baseDir: '/fake/dir',
      expected: [],
    },
    {
      name: 'returns empty array for number value',
      value: 42,
      baseDir: '/fake/dir',
      expected: [],
    },
    {
      name: 'returns empty array for object value',
      value: { foo: 'bar' },
      baseDir: '/fake/dir',
      expected: [],
    },
    {
      name: 'returns empty array for empty array value',
      value: [],
      baseDir: '/fake/dir',
      expected: [],
    },
    {
      name: 'returns empty array for array of non-strings',
      value: [42, null, true],
      baseDir: '/fake/dir',
      expected: [],
    },
  ])('$name', ({ value, baseDir, expected }) => {
    const result = normalizeExtends(value, baseDir);

    expect(result).toEqual(expected);
  });
});
