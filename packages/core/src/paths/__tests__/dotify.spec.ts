import { dotifyObject } from '@/paths/dotify';

describe('dotifyObject', () => {
  it('flattens nested object to dotted keys', () => {
    const input = {
      server: { port: 3000, host: 'localhost' },
      db: { pool: { min: 2, max: 10 } },
    };

    expect(dotifyObject(input)).toEqual({
      'server.port': 3000,
      'server.host': 'localhost',
      'db.pool.min': 2,
      'db.pool.max': 10,
    });
  });

  it('flattens array indices with bracket notation', () => {
    const input = {
      users: [{ name: 'Alice' }, { name: 'Bob' }],
      tags: ['a', 'b'],
    };

    expect(dotifyObject(input)).toEqual({
      'users[0].name': 'Alice',
      'users[1].name': 'Bob',
      'tags[0]': 'a',
      'tags[1]': 'b',
    });
  });

  it('handles empty objects and arrays', () => {
    const input = {
      emptyObj: {},
      emptyArr: [],
    };

    expect(dotifyObject(input)).toEqual({
      emptyObj: {},
      emptyArr: [],
    });
  });

  it('ignores primitive value at top-level with empty prefix', () => {
    expect(dotifyObject(42)).toEqual({});
    expect(dotifyObject('hello')).toEqual({});
    expect(dotifyObject(null)).toEqual({});
  });

  it.each([
    { input: {}, label: 'empty object' },
    { input: [], label: 'empty array' },
  ])('does not add $label to result when prefix is empty', ({ input }) => {
    expect(dotifyObject(input)).toEqual({});
  });
});
