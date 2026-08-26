import { createStableProxy } from '@/store/reactive/stable-proxy';
import type { StoreState } from '@/store/store-state';

function createState<T extends Record<string, unknown>>(
  config: T,
  overrides: Partial<StoreState<T>> = {},
): StoreState<T> {
  return {
    _config: config,
    _proxy: undefined,
    _stoppedConfig: undefined,
    _layers: [],
    listeners: new Map(),
    wildcardListeners: new Map(),
    stopped: false,
    watchers: new Set(),
    watchedFiles: new Map(),
    projectPath: '/project/config.json',
    options: {} as never,
    lastConfig: {},
    remergeInProgress: false,
    remergeDone: undefined,
    enoentLogged: new Set(),
    writeQueue: Promise.resolve(),
    queueEnabled: true,
    inTransaction: false,
    transactionDirtyKeys: new Map(),
    ...overrides,
  } as StoreState<T>;
}

describe('createStableProxy', () => {
  describe('get - top level', () => {
    it('returns primitive values from config', () => {
      const state = createState({ foo: 'bar', num: 42, bool: true });
      const proxy = createStableProxy(state, 'frozen');

      expect(proxy['foo']).toBe('bar');
      expect(proxy['num']).toBe(42);
      expect(proxy['bool']).toBe(true);
    });

    it('returns undefined for missing keys', () => {
      const state = createState({ foo: 'bar' });
      const proxy = createStableProxy(state, 'frozen');

      expect((proxy as Record<string, unknown>)['missing']).toBeUndefined();
    });

    it('returns null values directly', () => {
      const state = createState({ foo: null });
      const proxy = createStableProxy(state, 'frozen');

      expect(proxy['foo']).toBeNull();
    });

    it('returns symbol properties from config', () => {
      const sym = Symbol('test');
      const state = createState({ [sym]: 'symbol-value' } as never);
      const proxy = createStableProxy(state, 'frozen');

      expect((proxy as never)[sym]).toBe('symbol-value');
    });

    it('returns raw object for symbol properties (not wrapped in proxy)', () => {
      const sym = Symbol('obj');
      const raw = { inner: 'value' };
      const state = createState({ [sym]: raw } as never);
      const proxy = createStableProxy(state, 'frozen');

      expect((proxy as never)[sym]).toBe(raw);
    });

    it('returns nested objects as proxies', () => {
      const state = createState({ nested: { inner: 'value' } });
      const proxy = createStableProxy(state, 'frozen');

      const nested = proxy['nested'] as Record<string, unknown>;
      expect(nested['inner']).toBe('value');
      expect(nested).not.toBe(state._config['nested']);
    });

    it('wraps arrays as proxy arrays (preserves Array.isArray)', () => {
      const state = createState({ items: [1, 2, 3] });
      const proxy = createStableProxy(state, 'frozen');

      const items = proxy['items'] as unknown;
      expect(Array.isArray(items)).toBe(true);
      expect((items as unknown[])[0]).toBe(1);
      expect((items as unknown[])[1]).toBe(2);
      expect((items as unknown[])[2]).toBe(3);
      expect((items as { length: number }).length).toBe(3);
    });

    it('returns descriptor for length on array proxy without throwing', () => {
      const state = createState({ items: [1, 2, 3] });
      const proxy = createStableProxy(state, 'frozen');

      const items = proxy['items'] as unknown;
      const desc = Object.getOwnPropertyDescriptor(items, 'length');
      expect(desc).toBeDefined();
      expect(desc!.value).toBe(0);
    });
  });

  describe('get - nested level', () => {
    it('returns nested primitive values', () => {
      const state = createState({ a: { b: { c: 'deep' } } });
      const proxy = createStableProxy(state, 'frozen');

      const a = proxy['a'] as Record<string, unknown>;
      const b = a['b'] as Record<string, unknown>;
      expect(b['c']).toBe('deep');
    });

    it('returns nested null values directly', () => {
      const state = createState({ a: { b: null } });
      const proxy = createStableProxy(state, 'frozen');

      const a = proxy['a'] as Record<string, unknown>;
      expect(a['b']).toBeNull();
    });

    it('returns nested symbol properties', () => {
      const sym = Symbol('nested');
      const state = createState({ a: { [sym]: 'sym-val' } } as never);
      const proxy = createStableProxy(state, 'frozen');

      const a = proxy['a'] as Record<string, unknown>;
      expect((a as never)[sym]).toBe('sym-val');
    });

    it('returns raw object for nested symbol properties (not wrapped)', () => {
      const sym = Symbol('nestedObj');
      const raw = { deep: true };
      const state = createState({ a: { [sym]: raw } } as never);
      const proxy = createStableProxy(state, 'frozen');

      const a = proxy['a'] as Record<string, unknown>;
      expect((a as never)[sym]).toBe(raw);
    });

    it('wraps deeply nested objects as proxies (not raw)', () => {
      const state = createState({ a: { b: { c: 1 } } });
      const proxy = createStableProxy(state, 'frozen');

      const a = proxy['a'] as Record<string, unknown>;
      const b = a['b'] as Record<string, unknown>;
      expect(b['c']).toBe(1);
      expect(b).not.toBe((state._config['a'] as Record<string, unknown>)['b']);
    });

    it('wraps nested arrays as proxy arrays (preserves Array.isArray)', () => {
      const state = createState({ a: { items: [1, 2] } });
      const proxy = createStableProxy(state, 'frozen');

      const a = proxy['a'] as Record<string, unknown>;
      const items = a['items'] as unknown;
      expect(Array.isArray(items)).toBe(true);
      expect((items as unknown[])[0]).toBe(1);
      expect((items as unknown[])[1]).toBe(2);
    });

    it('returns descriptor for array element from config (not from empty proxy target)', () => {
      const state = createState({ items: ['a', 'b', 'c'] });
      const proxy = createStableProxy(state, 'frozen');

      const items = proxy['items'] as unknown;
      const desc = Object.getOwnPropertyDescriptor(items, '0');
      expect(desc).toBeDefined();
      expect(desc!.value).toBe('a');
      expect(desc!.configurable).toBe(true);
    });

    it('returns cached proxy for same nested object', () => {
      const state = createState({ a: { b: 1 } });
      const proxy = createStableProxy(state, 'frozen');

      const nested1 = proxy['a'];
      const nested2 = proxy['a'];

      expect(nested1).toBe(nested2);
    });
  });

  describe('has', () => {
    it('reflects has from config', () => {
      const state = createState({ foo: 'bar' });
      const proxy = createStableProxy(state, 'frozen');

      expect('foo' in proxy).toBe(true);
      expect('missing' in proxy).toBe(false);
    });

    it('reflects has from nested config', () => {
      const state = createState({ a: { b: 1 } });
      const proxy = createStableProxy(state, 'frozen');

      const a = proxy['a'] as Record<string, unknown>;
      expect('b' in a).toBe(true);
      expect('c' in a).toBe(false);
    });
  });

  describe('ownKeys', () => {
    it('reflects ownKeys from config', () => {
      const state = createState({ foo: 1, bar: 2 });
      const proxy = createStableProxy(state, 'frozen');

      expect(Object.keys(proxy)).toEqual(['foo', 'bar']);
    });

    it('reflects ownKeys from nested config', () => {
      const state = createState({ a: { b: 1, c: 2 } });
      const proxy = createStableProxy(state, 'frozen');

      const a = proxy['a'] as Record<string, unknown>;
      expect(Object.keys(a)).toEqual(['b', 'c']);
    });
  });

  describe('getOwnPropertyDescriptor', () => {
    it('returns descriptor from config', () => {
      const state = createState({ foo: 'bar' });
      const proxy = createStableProxy(state, 'frozen');

      const desc = Object.getOwnPropertyDescriptor(proxy, 'foo');
      expect(desc).toBeDefined();
      expect(desc!.value).toBe('bar');
      expect(desc!.configurable).toBe(true);
    });

    it('returns undefined for missing properties', () => {
      const state = createState({ foo: 'bar' });
      const proxy = createStableProxy(state, 'frozen');

      const desc = Object.getOwnPropertyDescriptor(proxy, 'missing');
      expect(desc).toBeUndefined();
    });

    it('returns descriptor from nested config', () => {
      const state = createState({ a: { b: 1 } });
      const proxy = createStableProxy(state, 'frozen');

      const a = proxy['a'] as Record<string, unknown>;
      const desc = Object.getOwnPropertyDescriptor(a, 'b');
      expect(desc).toBeDefined();
      expect(desc!.value).toBe(1);
      expect(desc!.configurable).toBe(true);
    });

    it('forces configurable to true for non-configurable properties', () => {
      const config = {} as Record<string, unknown>;
      Object.defineProperty(config, 'locked', {
        value: 'secret',
        writable: true,
        enumerable: true,
        configurable: false,
      });
      const state = createState(config);
      const proxy = createStableProxy(state, 'frozen');

      const desc = Object.getOwnPropertyDescriptor(proxy, 'locked');
      expect(desc).toBeDefined();
      expect(desc!.configurable).toBe(true);
    });

    it('forces configurable to true for nested non-configurable properties', () => {
      const nested = {} as Record<string, unknown>;
      Object.defineProperty(nested, 'locked', {
        value: 'secret',
        writable: true,
        enumerable: true,
        configurable: false,
      });
      const state = createState({ a: nested });
      const proxy = createStableProxy(state, 'frozen');

      const a = proxy['a'] as Record<string, unknown>;
      const desc = Object.getOwnPropertyDescriptor(a, 'locked');
      expect(desc).toBeDefined();
      expect(desc!.configurable).toBe(true);
    });
  });

  describe('set - frozen mutability', () => {
    it.each([
      {
        name: 'top-level',
        config: { foo: 'bar' },
        mutate: (p: Record<string, unknown>) => {
          p['foo'] = 'new';
        },
      },
      {
        name: 'nested',
        config: { a: { b: 1 } },
        mutate: (p: Record<string, unknown>) => {
          (p['a'] as Record<string, unknown>)['b'] = 2;
        },
      },
    ])('prevents set on $name in frozen mode', ({ config, mutate }) => {
      const state = createState(config);
      const proxy = createStableProxy(state, 'frozen');

      expect(() => mutate(proxy as Record<string, unknown>)).toThrow(TypeError);
    });
  });

  describe('set - mutable mutability', () => {
    it('allows set on top-level in mutable mode', () => {
      const state = createState({ foo: 'bar' });
      const proxy = createStableProxy(state, 'mutable');

      (proxy as Record<string, unknown>)['foo'] = 'new';

      expect(state._config['foo']).toBe('new');
    });

    it('allows set on nested in mutable mode', () => {
      const state = createState({ a: { b: 1 } });
      const proxy = createStableProxy(state, 'mutable');

      const a = proxy['a'] as Record<string, unknown>;
      a['b'] = 2;

      expect((state._config['a'] as Record<string, unknown>)['b']).toBe(2);
    });
  });

  describe('deleteProperty - frozen mutability', () => {
    it.each([
      {
        name: 'top-level',
        config: { foo: 'bar' },
        mutate: (p: Record<string, unknown>) => {
          delete p['foo'];
        },
      },
      {
        name: 'nested',
        config: { a: { b: 1 } },
        mutate: (p: Record<string, unknown>) => {
          delete (p['a'] as Record<string, unknown>)['b'];
        },
      },
    ])('prevents delete on $name in frozen mode', ({ config, mutate }) => {
      const state = createState(config);
      const proxy = createStableProxy(state, 'frozen');

      expect(() => mutate(proxy as Record<string, unknown>)).toThrow(TypeError);
    });
  });

  describe('deleteProperty - mutable mutability', () => {
    it('allows delete on top-level in mutable mode', () => {
      const state = createState({ foo: 'bar' });
      const proxy = createStableProxy(state, 'mutable');

      delete (proxy as Record<string, unknown>)['foo'];

      expect('foo' in state._config).toBe(false);
    });

    it('allows delete on nested in mutable mode', () => {
      const state = createState({ a: { b: 1 } });
      const proxy = createStableProxy(state, 'mutable');

      const a = proxy['a'] as Record<string, unknown>;
      delete a['b'];

      expect('b' in (state._config['a'] as Record<string, unknown>)).toBe(
        false,
      );
    });
  });

  describe('live-reload - proxy forwards to updated config', () => {
    it('top-level getter reflects config swap', () => {
      const state = createState({ foo: 'old' });
      const proxy = createStableProxy(state, 'frozen');

      expect(proxy['foo']).toBe('old');

      state._config = { foo: 'new' } as never;
      expect(proxy['foo']).toBe('new');
    });

    it('nested getter reflects config swap', () => {
      const state = createState({ a: { b: 'old' } });
      const proxy = createStableProxy(state, 'frozen');

      const a = proxy['a'] as Record<string, unknown>;
      expect(a['b']).toBe('old');

      state._config = { a: { b: 'new' } } as never;
      const a2 = proxy['a'] as Record<string, unknown>;
      expect(a2['b']).toBe('new');
    });
  });

  describe('empty config', () => {
    it('handles empty config object', () => {
      const state = createState({});
      const proxy = createStableProxy(state, 'frozen');

      expect(Object.keys(proxy)).toEqual([]);
    });
  });

  describe('edge cases for branch coverage', () => {
    it('does not cache proxy when nested value is null', () => {
      const state = createState({
        a: null as unknown as Record<string, unknown>,
      });
      const proxy = createStableProxy(state, 'frozen');

      expect(proxy['a']).toBeNull();
    });

    it('returns undefined for missing nested property descriptor', () => {
      const state = createState({ a: { b: 1 } });
      const proxy = createStableProxy(state, 'frozen');

      const a = proxy['a'] as Record<string, unknown>;
      const desc = Object.getOwnPropertyDescriptor(a, 'missing');
      expect(desc).toBeUndefined();
    });

    it('handles config swap removing nested object (resolvePath returns undefined)', () => {
      const state = createState({ a: { b: { c: 1 } } });
      const proxy = createStableProxy(state, 'frozen');

      const a = proxy['a'] as Record<string, unknown>;
      const b = a['b'] as Record<string, unknown>;
      expect(b['c']).toBe(1);

      state._config = { a: { b: undefined } } as never;
      const a2 = proxy['a'] as Record<string, unknown>;
      expect(a2['b']).toBeUndefined();
    });

    it('held nested proxy returns undefined (not TypeError) after parent removed', () => {
      const state = createState({ a: { b: { c: 1, d: 2 } } });
      const proxy = createStableProxy(state, 'frozen');

      const b = (proxy['a'] as Record<string, unknown>)['b'] as Record<
        string,
        unknown
      >;
      expect(b['c']).toBe(1);
      expect(Object.keys(b)).toEqual(['c', 'd']);

      state._config = { a: { b: undefined } } as never;

      expect(b['c']).toBeUndefined();
      expect(b['d']).toBeUndefined();
      expect(b['missing']).toBeUndefined();
      expect(Object.keys(b)).toEqual([]);
      expect('c' in b).toBe(false);
      expect(Object.getOwnPropertyDescriptor(b, 'c')).toBeUndefined();
    });

    it('held nested proxy returns undefined after parent changed to primitive', () => {
      const state = createState({ a: { b: { c: 1 } } });
      const proxy = createStableProxy(state, 'frozen');

      const b = (proxy['a'] as Record<string, unknown>)['b'] as Record<
        string,
        unknown
      >;

      state._config = { a: { b: 42 } } as never;
      expect(b['c']).toBeUndefined();
    });

    it('held nested proxy reflects live-reload after parent restored', () => {
      const state = createState({ a: { b: { c: 1 } } });
      const proxy = createStableProxy(state, 'frozen');

      const b = (proxy['a'] as Record<string, unknown>)['b'] as Record<
        string,
        unknown
      >;

      state._config = { a: { b: undefined } } as never;
      expect(b['c']).toBeUndefined();

      state._config = { a: { b: { c: 100, e: 200 } } } as never;
      expect(b['c']).toBe(100);
      expect(b['e']).toBe(200);
      expect(Object.keys(b)).toEqual(['c', 'e']);
    });

    it('held deep nested proxy returns undefined after mid-traversal removal', () => {
      const state = createState({ a: { b: { c: { d: 1 } } } });
      const proxy = createStableProxy(state, 'frozen');

      const c = (
        (proxy['a'] as Record<string, unknown>)['b'] as Record<string, unknown>
      )['c'] as Record<string, unknown>;
      expect(c['d']).toBe(1);

      state._config = { a: { b: undefined } } as never;
      expect(c['d']).toBeUndefined();
    });

    // `typeof null === 'object'` — without the `current === null` guard, the
    // loop would attempt `(null as ConfigRecord)[key]` → TypeError. This test
    // kills the mutant that removes the `current === null` branch from the
    // mid-traversal check.
    it('held deep nested proxy returns undefined after mid-traversal null', () => {
      const state = createState({ a: { b: { c: { d: 1 } } } });
      const proxy = createStableProxy(state, 'frozen');

      const c = (
        (proxy['a'] as Record<string, unknown>)['b'] as Record<string, unknown>
      )['c'] as Record<string, unknown>;
      expect(c['d']).toBe(1);

      state._config = { a: { b: null } } as never;
      expect(c['d']).toBeUndefined();
      expect(Object.keys(c)).toEqual([]);
    });

    // `typeof null === 'object'` — without the final `current !== null` guard,
    // `resolvePath` would return `null as ConfigRecord` instead of EMPTY.
    // `Reflect.get(null, prop)` → TypeError. This test kills the mutant that
    // removes the `current !== null` branch from the final check.
    it('held nested proxy returns undefined after parent changed to null', () => {
      const state = createState({ a: { b: { c: 1 } } });
      const proxy = createStableProxy(state, 'frozen');

      const b = (proxy['a'] as Record<string, unknown>)['b'] as Record<
        string,
        unknown
      >;
      expect(b['c']).toBe(1);

      state._config = { a: { b: null } } as never;
      expect(b['c']).toBeUndefined();
      expect(Object.keys(b)).toEqual([]);
      expect('c' in b).toBe(false);
    });
  });
});
