import { isWildcardMatch, isWildcardPattern } from '@/store/match-wildcard';

describe('isWildcardMatch', () => {
  it.each<{
    name: string;
    pattern: string;
    key: string;
    expected: boolean;
  }>([
    {
      name: 'exact match — no wildcards',
      pattern: 'foo.bar',
      key: 'foo.bar',
      expected: true,
    },
    {
      name: 'exact mismatch — no wildcards',
      pattern: 'foo.bar',
      key: 'foo.baz',
      expected: false,
    },
    {
      name: 'single * matches one segment',
      pattern: 'foo.*',
      key: 'foo.bar',
      expected: true,
    },
    {
      name: 'single * does not match deeper key',
      pattern: 'foo.*',
      key: 'foo.bar.baz',
      expected: false,
    },
    {
      name: 'single * does not match shallower key',
      pattern: 'foo.*',
      key: 'foo',
      expected: false,
    },
    {
      name: '** matches zero segments',
      pattern: 'foo.**',
      key: 'foo',
      expected: true,
    },
    {
      name: '** matches one segment',
      pattern: 'foo.**',
      key: 'foo.bar',
      expected: true,
    },
    {
      name: '** matches multiple segments',
      pattern: 'foo.**',
      key: 'foo.bar.baz.qux',
      expected: true,
    },
    {
      name: 'bare ** matches any key',
      pattern: '**',
      key: 'foo.bar.baz',
      expected: true,
    },
    {
      name: 'bare ** matches single segment key',
      pattern: '**',
      key: 'foo',
      expected: true,
    },
    {
      name: '** in middle matches multiple segments',
      pattern: 'foo.**.baz',
      key: 'foo.bar.qux.baz',
      expected: true,
    },
    {
      name: '** in middle matches zero segments',
      pattern: 'foo.**.baz',
      key: 'foo.baz',
      expected: true,
    },
    {
      name: 'mixed * and ** — * matches one, ** matches rest',
      pattern: '*.*.**',
      key: 'a.b.c.d.e',
      expected: true,
    },
    {
      name: 'mixed * and ** — * requires exact segment count',
      pattern: '*.*.**',
      key: 'a.b',
      expected: true,
    },
    {
      name: 'pattern longer than key without ** — no match',
      pattern: 'a.b.c',
      key: 'a.b',
      expected: false,
    },
    {
      name: 'key longer than pattern without ** — no match',
      pattern: 'a.b',
      key: 'a.b.c',
      expected: false,
    },
    {
      name: 'trailing ** after exact segments',
      pattern: 'a.b.**',
      key: 'a.b.c.d',
      expected: true,
    },
    {
      name: 'trailing ** with exact match',
      pattern: 'a.b.**',
      key: 'a.b',
      expected: true,
    },
    {
      name: 'non-wildcard segment mismatch in wildcard pattern',
      pattern: 'a.*.c',
      key: 'a.x.y',
      expected: false,
    },
    {
      name: 'pattern is anchored — does not match shifted key',
      pattern: 'a.*.c',
      key: 'x.a.y.c',
      expected: false,
    },
  ])('$name', ({ pattern, key, expected }) => {
    expect(isWildcardMatch(pattern, key)).toBe(expected);
  });
});

describe('isWildcardPattern', () => {
  it.each([
    { name: 'no wildcards', pattern: 'foo.bar', expected: false },
    { name: 'single *', pattern: 'foo.*', expected: true },
    { name: 'double **', pattern: 'foo.**', expected: true },
    { name: 'bare **', pattern: '**', expected: true },
    { name: 'mixed * and **', pattern: '*.*.**', expected: true },
    { name: 'literal star in segment', pattern: 'foo.*bar', expected: true },
  ])('returns $expected for $name', ({ pattern, expected }) => {
    expect(isWildcardPattern(pattern)).toBe(expected);
  });
});
