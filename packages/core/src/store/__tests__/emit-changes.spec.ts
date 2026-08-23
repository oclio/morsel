import { diffKeys } from '@/merge/diff-keys';
import { compareAsc, emitChanges } from '@/store/emit-changes';
import type { Listener } from '@/store/types';

vi.mock('@/merge/diff-keys', () => ({
  diffKeys: vi.fn(),
}));

describe('emitChanges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emits changes to registered listeners with next and previous values', () => {
    vi.mocked(diffKeys).mockReturnValue(
      new Map([['foo', { next: 2, prev: 1, category: 'modified' }]]),
    );

    const listener = vi.fn() as unknown as Listener;
    const listeners = new Map([['foo', new Set([listener])]]);

    emitChanges({ foo: 1 }, { foo: 2 }, listeners);

    expect(listener).toHaveBeenCalledWith({
      keyPath: 'foo',
      type: 'modified',
      next: 2,
      prev: 1,
    });
  });

  it('emits to multiple listeners for the same key', () => {
    vi.mocked(diffKeys).mockReturnValue(
      new Map([['bar', { next: 'new', prev: 'old', category: 'modified' }]]),
    );

    const listener1 = vi.fn() as unknown as Listener;
    const listener2 = vi.fn() as unknown as Listener;
    const listeners = new Map([['bar', new Set([listener1, listener2])]]);

    emitChanges({ bar: 'old' }, { bar: 'new' }, listeners);

    expect(listener1).toHaveBeenCalledWith({
      keyPath: 'bar',
      type: 'modified',
      next: 'new',
      prev: 'old',
    });
    expect(listener2).toHaveBeenCalledWith({
      keyPath: 'bar',
      type: 'modified',
      next: 'new',
      prev: 'old',
    });
  });

  it('skips keys with no registered listeners', () => {
    vi.mocked(diffKeys).mockReturnValue(
      new Map([
        ['foo', { next: 2, prev: 1, category: 'modified' }],
        ['bar', { next: 4, prev: 3, category: 'modified' }],
      ]),
    );

    const listener = vi.fn() as unknown as Listener;
    const listeners = new Map([['foo', new Set([listener])]]);

    emitChanges({ foo: 1, bar: 3 }, { foo: 2, bar: 4 }, listeners);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      keyPath: 'foo',
      type: 'modified',
      next: 2,
      prev: 1,
    });
  });

  it('skips removed keys with no registered listeners', () => {
    vi.mocked(diffKeys).mockReturnValue(
      new Map([
        ['gone', { next: undefined, prev: 1, category: 'removed' }],
        ['kept', { next: 2, prev: 1, category: 'modified' }],
      ]),
    );

    const listener = vi.fn() as unknown as Listener;
    const listeners = new Map([['kept', new Set([listener])]]);

    emitChanges({ gone: 1, kept: 1 }, { kept: 2 }, listeners);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      keyPath: 'kept',
      type: 'modified',
      next: 2,
      prev: 1,
    });
  });

  it('emits removed key event with correct payload', () => {
    vi.mocked(diffKeys).mockReturnValue(
      new Map([['gone', { next: undefined, prev: 42, category: 'removed' }]]),
    );

    const listener = vi.fn() as unknown as Listener;
    const listeners = new Map([['gone', new Set([listener])]]);

    emitChanges({ gone: 42 }, {}, listeners);

    expect(listener).toHaveBeenCalledWith({
      keyPath: 'gone',
      type: 'removed',
      next: undefined,
      prev: 42,
    });
  });

  it('emits removed keys bottom-up first, then added/modified top-down', () => {
    const callOrder: string[] = [];
    vi.mocked(diffKeys).mockReturnValue(
      new Map([
        ['a.b', { next: undefined, prev: 1, category: 'removed' }],
        ['a.c', { next: undefined, prev: 2, category: 'removed' }],
        ['x.y', { next: 3, prev: undefined, category: 'added' }],
        ['x.a', { next: 4, prev: undefined, category: 'added' }],
        ['a', { next: 2, prev: { b: 1, c: 2 }, category: 'modified' }],
      ]),
    );

    const listeners = new Map<string, Set<Listener>>([
      [
        'a.b',
        new Set([
          ((): void => {
            callOrder.push('a.b');
          }) as Listener,
        ]),
      ],
      [
        'a.c',
        new Set([
          ((): void => {
            callOrder.push('a.c');
          }) as Listener,
        ]),
      ],
      [
        'x.a',
        new Set([
          ((): void => {
            callOrder.push('x.a');
          }) as Listener,
        ]),
      ],
      [
        'x.y',
        new Set([
          ((): void => {
            callOrder.push('x.y');
          }) as Listener,
        ]),
      ],
      [
        'a',
        new Set([
          ((): void => {
            callOrder.push('a');
          }) as Listener,
        ]),
      ],
    ]);

    emitChanges({}, {}, listeners);

    expect(callOrder).toEqual(['a.c', 'a.b', 'a', 'x.a', 'x.y']);
  });

  it('does nothing when diffKeys returns empty map', () => {
    vi.mocked(diffKeys).mockReturnValue(new Map());

    const listener = vi.fn() as unknown as Listener;
    const listeners = new Map([['foo', new Set([listener])]]);

    emitChanges({ foo: 1 }, { foo: 1 }, listeners);

    expect(listener).not.toHaveBeenCalled();
  });

  it('does nothing when listeners map is empty', () => {
    vi.mocked(diffKeys).mockReturnValue(
      new Map([['foo', { next: 2, prev: 1, category: 'modified' }]]),
    );

    const listeners = new Map<string, Set<Listener>>();

    emitChanges({ foo: 1 }, { foo: 2 }, listeners);
  });

  it('passes oldConfig and newConfig to diffKeys', () => {
    vi.mocked(diffKeys).mockReturnValue(new Map());

    const oldConfig = { foo: 1 };
    const newConfig = { foo: 2 };

    emitChanges(oldConfig, newConfig, new Map());

    expect(diffKeys).toHaveBeenCalledWith(oldConfig, newConfig);
  });

  it.each([
    {
      name: 'removed keys — deepest first, descending alphabetical at same depth',
      category: 'removed' as const,
      next: undefined,
      expected: ['x.y', 'a.b', 'abcde'],
    },
    {
      name: 'added/modified keys — shallowest first, ascending alphabetical at same depth',
      category: 'modified' as const,
      next: 1,
      expected: ['abcde', 'a.b', 'x.y'],
    },
  ])(
    'sorts by depth before alphabetical — $name',
    ({ category, next, expected }) => {
      const callOrder: string[] = [];
      vi.mocked(diffKeys).mockReturnValue(
        new Map([
          ['a.b', { next, prev: 0, category }],
          ['abcde', { next, prev: 0, category }],
          ['x.y', { next, prev: 0, category }],
        ]),
      );

      const listeners = new Map<string, Set<Listener>>([
        [
          'a.b',
          new Set([
            ((): void => {
              callOrder.push('a.b');
            }) as Listener,
          ]),
        ],
        [
          'abcde',
          new Set([
            ((): void => {
              callOrder.push('abcde');
            }) as Listener,
          ]),
        ],
        [
          'x.y',
          new Set([
            ((): void => {
              callOrder.push('x.y');
            }) as Listener,
          ]),
        ],
      ]);

      emitChanges({}, {}, listeners);

      expect(callOrder).toEqual(expected);
    },
  );

  it('emits nested dotted keys top-down within added/modified phase', () => {
    const callOrder: string[] = [];
    vi.mocked(diffKeys).mockReturnValue(
      new Map([
        ['b.x', { next: 1, prev: 0, category: 'modified' }],
        ['a.y', { next: 1, prev: 0, category: 'modified' }],
        ['a.x', { next: 1, prev: 0, category: 'modified' }],
      ]),
    );

    const listeners = new Map<string, Set<Listener>>([
      [
        'b.x',
        new Set([
          ((): void => {
            callOrder.push('b.x');
          }) as Listener,
        ]),
      ],
      [
        'a.y',
        new Set([
          ((): void => {
            callOrder.push('a.y');
          }) as Listener,
        ]),
      ],
      [
        'a.x',
        new Set([
          ((): void => {
            callOrder.push('a.x');
          }) as Listener,
        ]),
      ],
    ]);

    emitChanges({}, {}, listeners);

    expect(callOrder).toEqual(['a.x', 'a.y', 'b.x']);
  });
});

describe('compareAsc', () => {
  it.each([
    { name: 'equal strings', a: 'a.b', b: 'a.b', expected: 0 },
    { name: 'a > b', a: 'b', b: 'a', expected: 1 },
    { name: 'a < b', a: 'a', b: 'b', expected: -1 },
  ])('returns $expected when $name', ({ a, b, expected }) => {
    expect(compareAsc(a, b)).toBe(expected);
  });
});
