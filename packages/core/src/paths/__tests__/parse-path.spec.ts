import { parsePath, type PathSegment, validatePath } from '@/paths/parse-path';

describe('validatePath', () => {
  it.each([
    { segments: ['a', '__proto__', 'b'], label: '__proto__' },
    { segments: ['constructor', 'b'], label: 'constructor' },
    { segments: ['a', 'prototype'], label: 'prototype' },
  ])('throws on $label', ({ segments }) => {
    expect(() => validatePath(segments)).toThrow(TypeError);
  });

  it('includes segment in error message', () => {
    expect(() => validatePath(['__proto__'])).toThrow('prototype pollution');
  });

  it('passes for safe segments', () => {
    expect(() => validatePath(['a', 'b', 0, 'c'])).not.toThrow();
  });
});

describe('parsePath', () => {
  it.each([
    { path: '', expected: [] as PathSegment[], label: 'empty string' },
    { path: 'a.b.c', expected: ['a', 'b', 'c'], label: 'simple dot notation' },
    {
      path: 'users[0].name',
      expected: ['users', 0, 'name'],
      label: 'bracket array index',
    },
    {
      path: 'items[12][3]',
      expected: ['items', 12, 3],
      label: 'chained brackets',
    },
    {
      path: 'users.0.name',
      expected: ['users', 0, 'name'],
      label: 'dot array index',
    },
    {
      path: 'a[0]',
      expected: ['a', 0],
      label: 'bracket without preceding dot',
    },
    {
      path: 'a[0]b',
      expected: ['a', 0, 'b'],
      label: 'bracket with trailing segment',
    },
  ])('parses $label', ({ path, expected }) => {
    expect(parsePath(path)).toEqual(expected);
  });

  it.each([
    { path: '01', expected: ['01'], label: 'leading zeros stay string' },
    { path: '-1', expected: ['-1'], label: 'negative numbers stay string' },
  ])('keeps $label', ({ path, expected }) => {
    expect(parsePath(path)).toEqual(expected);
  });

  it.each([
    {
      path: 'app\\.config.host',
      expected: ['app.config', 'host'],
      label: 'escaped dots',
    },
    { path: '\\.a', expected: ['.a'], label: 'leading backslash as escape' },
  ])('supports $label', ({ path, expected }) => {
    expect(parsePath(path)).toEqual(expected);
  });

  it.each([
    {
      path: ['users', '0', 'name'] as const,
      expected: ['users', 0, 'name'],
      label: 'string segments normalized',
    },
    {
      path: ['users', 0, 'name'] as const,
      expected: ['users', 0, 'name'],
      label: 'numeric segments preserved',
    },
  ])('normalizes array input: $label', ({ path, expected }) => {
    expect(parsePath(path)).toEqual(expected);
  });

  it.each([
    {
      path: 'a.__proto__.b' as never,
      label: 'prototype pollution during string parsing',
    },
    { path: 123 as unknown as string, label: 'invalid path type' },
  ])('throws on $label', ({ path }) => {
    expect(() => parsePath(path)).toThrow(TypeError);
  });
});
