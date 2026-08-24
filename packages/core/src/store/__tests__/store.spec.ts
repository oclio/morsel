import { applyMutability } from '@/load/merge-layers';
import {
  popKey,
  pushKey,
  shiftKey,
  spliceKey,
  unshiftKey,
} from '@/store/array-ops';
import { emitChanges } from '@/store/reactive/emit-changes';
import { createStableProxy } from '@/store/reactive/stable-proxy';
import { createMorselStore } from '@/store/store';
import { deleteKey, mutateKey } from '@/store/store-mutator';
import type { StoreState } from '@/store/store-state';
import { releaseWatcher } from '@/watch/watcher-registry';

vi.mock('@/load/merge-layers', () => ({
  applyMutability: vi.fn(),
}));
vi.mock('@/store/array-ops', () => ({
  popKey: vi.fn(),
  pushKey: vi.fn(),
  shiftKey: vi.fn(),
  spliceKey: vi.fn(),
  unshiftKey: vi.fn(),
}));
vi.mock('@/store/reactive/stable-proxy', () => ({
  createStableProxy: vi.fn(),
}));
vi.mock('@/store/store-mutator', () => ({
  deleteKey: vi.fn(),
  mutateKey: vi.fn(),
}));
vi.mock('@/watch/watcher-registry', () => ({
  releaseWatcher: vi.fn(),
}));

function createState<T extends Record<string, unknown>>(
  overrides: Partial<StoreState<T>> = {},
): StoreState<T> {
  return {
    _config: { foo: 'bar' } as unknown as T,
    _proxy: undefined,
    _stoppedConfig: undefined,
    _layers: [],
    listeners: new Map(),
    wildcardListeners: new Map(),
    stopped: false,
    watchers: new Set(),
    watchedFiles: new Map(),
    projectPath: '/project/config.json',
    options: { hooks: [] } as never,
    lastConfig: {},
    remergeInProgress: false,
    remergeDone: undefined,
    pendingRemerge: false,
    debounceTimers: new Map(),
    debounceMs: 300,
    remerge: vi.fn(),
    enoentLogged: new Set(),
    ...overrides,
  } as StoreState<T>;
}

describe('createMorselStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createStableProxy).mockReturnValue({ proxied: true } as never);
    vi.mocked(applyMutability).mockImplementation((config) => config);
  });

  describe('config getter', () => {
    it('returns proxy when not stopped', () => {
      const state = createState();
      const store = createMorselStore(state, 'frozen');

      expect(store.config).toEqual({ proxied: true });
    });

    it('returns state._config directly in mutable mode', () => {
      const config = { foo: 'bar' } as never;
      const state = createState({ _config: config });
      const store = createMorselStore(state, 'mutable');

      expect(store.config).toBe(config);
    });

    it('returns stopped config when stopped and _stoppedConfig is undefined', () => {
      const state = createState({ stopped: true, _stoppedConfig: undefined });
      vi.mocked(applyMutability).mockReturnValue({ frozen: true } as never);

      const store = createMorselStore(state, 'frozen');

      expect(store.config).toEqual({ frozen: true });
      expect(applyMutability).toHaveBeenCalledWith(state._config, 'frozen');
    });

    it('caches stopped config on first access', () => {
      const state = createState({ stopped: true, _stoppedConfig: undefined });
      vi.mocked(applyMutability).mockReturnValue({ frozen: true } as never);

      const store = createMorselStore(state, 'frozen');

      const first = store.config;
      const second = store.config;

      expect(first).toEqual(second);

      expect(applyMutability).toHaveBeenCalledTimes(1);
    });

    it('returns cached _stoppedConfig on subsequent access', () => {
      const cached = { cached: true } as never;
      const state = createState({ stopped: true, _stoppedConfig: cached });

      const store = createMorselStore(state, 'frozen');

      expect(store.config).toBe(cached);
      expect(applyMutability).not.toHaveBeenCalled();
    });
  });

  describe('layers getter', () => {
    it('returns a shallow copy of state layers', () => {
      const layers = [
        { source: 'defaults', path: undefined, config: {}, exists: true },
      ];
      const state = createState({ _layers: layers as never });

      const store = createMorselStore(state, 'frozen');

      expect(store.layers).not.toBe(layers);
      expect(store.layers).toEqual(layers);
    });
  });

  describe('on', () => {
    it('registers listener and returns unsubscribe function', () => {
      const state = createState();
      const store = createMorselStore(state, 'frozen');

      const listener = vi.fn();
      const unsub = store.on('foo', listener);

      expect(typeof unsub).toBe('function');
      expect(state.listeners.get('foo')).toBeDefined();
      expect(state.listeners.get('foo')!.has(listener)).toBe(true);
    });

    it('creates new set for first listener on a key', () => {
      const state = createState();
      const store = createMorselStore(state, 'frozen');

      store.on('foo', vi.fn());

      expect(state.listeners.get('foo')).toBeInstanceOf(Set);
    });

    it('adds to existing set for subsequent listeners on same key', () => {
      const state = createState();
      const store = createMorselStore(state, 'frozen');

      const listener1 = vi.fn();
      const listener2 = vi.fn();
      store.on('foo', listener1);
      store.on('foo', listener2);

      expect(state.listeners.get('foo')!.size).toBe(2);
    });

    it('unsubscribe removes listener from set', () => {
      const state = createState();
      const store = createMorselStore(state, 'frozen');

      const listener = vi.fn();
      const unsub = store.on('foo', listener);

      unsub();

      expect(state.listeners.get('foo')!.has(listener)).toBe(false);
    });

    it('throws when store is stopped', () => {
      const state = createState({ stopped: true });
      const store = createMorselStore(state, 'frozen');

      expect(() => store.on('foo', vi.fn())).toThrow(
        'morsel: store is stopped',
      );
    });

    it('registers wildcard pattern listener in wildcardListeners map', () => {
      const state = createState();
      const store = createMorselStore(state, 'frozen');

      const listener = vi.fn();
      store.on('foo.*', listener);

      expect(state.wildcardListeners.get('foo.*')).toBeDefined();
      expect(state.wildcardListeners.get('foo.*')!.has(listener)).toBe(true);
      expect(state.listeners.get('foo.*')).toBeUndefined();
    });

    it('registers ** wildcard listener in wildcardListeners map', () => {
      const state = createState();
      const store = createMorselStore(state, 'frozen');

      const listener = vi.fn();
      store.on('**', listener);

      expect(state.wildcardListeners.get('**')).toBeDefined();
      expect(state.listeners.get('**')).toBeUndefined();
    });

    it('auto-unsubscribes after first event when once is true', () => {
      const state = createState();
      const store = createMorselStore(state, 'frozen');

      const listener = vi.fn();
      store.on('foo', listener, { once: true });

      emitChanges(
        { foo: 0 },
        { foo: 1 },
        state.listeners,
        state.wildcardListeners,
      );
      emitChanges(
        { foo: 1 },
        { foo: 2 },
        state.listeners,
        state.wildcardListeners,
      );

      expect(listener).toHaveBeenCalledTimes(1);
      expect(state.listeners.get('foo')!.size).toBe(0);
    });

    it('auto-unsubscribes wildcard listener after first event when once is true', () => {
      const state = createState();
      const store = createMorselStore(state, 'frozen');

      const listener = vi.fn();
      store.on('foo.*', listener, { once: true });

      emitChanges(
        {},
        { foo: { bar: 1 } },
        state.listeners,
        state.wildcardListeners,
      );
      emitChanges(
        { foo: { bar: 1 } },
        { foo: { baz: 2 } },
        state.listeners,
        state.wildcardListeners,
      );

      expect(listener).toHaveBeenCalledTimes(1);
      expect(state.wildcardListeners.get('foo.*')!.size).toBe(0);
    });

    it('manual unsubscribe works with once listener', () => {
      const state = createState();
      const store = createMorselStore(state, 'frozen');

      const listener = vi.fn();
      const unsub = store.on('foo', listener, { once: true });

      unsub();

      expect(state.listeners.get('foo')!.size).toBe(0);
    });

    it('does not auto-unsubscribe when once is not set', () => {
      const state = createState();
      const store = createMorselStore(state, 'frozen');

      const listener = vi.fn();
      store.on('foo', listener);

      emitChanges(
        { foo: 0 },
        { foo: 1 },
        state.listeners,
        state.wildcardListeners,
      );
      emitChanges(
        { foo: 1 },
        { foo: 2 },
        state.listeners,
        state.wildcardListeners,
      );

      expect(listener).toHaveBeenCalledTimes(2);
      expect(state.listeners.get('foo')!.size).toBe(1);
    });
  });

  describe('stop', () => {
    it('sets stopped to true', async () => {
      const state = createState();
      const store = createMorselStore(state, 'frozen');

      await store.stop();

      expect(state.stopped).toBe(true);
    });

    it('returns early when already stopped without releasing watchers', async () => {
      const state = createState({
        stopped: true,
        watchers: new Set(['/dir1', '/dir2']),
      });
      const store = createMorselStore(state, 'frozen');

      await store.stop();

      expect(releaseWatcher).not.toHaveBeenCalled();
      expect(state.watchers.size).toBe(2);
    });

    it('awaits remergeDone promise if defined', async () => {
      let isResolved = false;
      const remergeDone = new Promise<void>((resolve) => {
        setTimeout(() => {
          isResolved = true;
          resolve();
        }, 10);
      });
      const state = createState({ remergeDone });
      const store = createMorselStore(state, 'frozen');

      await store.stop();

      expect(isResolved).toBe(true);
    });

    it('releases all watchers', async () => {
      const state = createState({
        watchers: new Set(['/dir1', '/dir2']),
      });
      const store = createMorselStore(state, 'frozen');

      await store.stop();

      expect(releaseWatcher).toHaveBeenCalledTimes(2);
      expect(releaseWatcher).toHaveBeenCalledWith('/dir1', state);
      expect(releaseWatcher).toHaveBeenCalledWith('/dir2', state);
    });

    it('clears watchers set', async () => {
      const state = createState({
        watchers: new Set(['/dir1']),
      });
      const store = createMorselStore(state, 'frozen');

      await store.stop();

      expect(state.watchers.size).toBe(0);
    });

    it('clears listeners and wildcardListeners maps', async () => {
      const state = createState();
      state.listeners.set('foo', new Set([vi.fn()]));
      state.wildcardListeners.set('**', new Set([vi.fn()]));
      const store = createMorselStore(state, 'frozen');

      await store.stop();

      expect(state.listeners.size).toBe(0);
      expect(state.wildcardListeners.size).toBe(0);
    });

    it('does not await remergeDone when undefined', async () => {
      const state = createState({ remergeDone: undefined });
      const store = createMorselStore(state, 'frozen');

      await store.stop();

      expect(state.stopped).toBe(true);
    });

    it('clears all debounce timers on stop', async () => {
      const timer1 = setTimeout(() => {}, 1000) as unknown as NodeJS.Timeout;
      const timer2 = setTimeout(() => {}, 2000) as unknown as NodeJS.Timeout;
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
      const state = createState({
        debounceTimers: new Map([
          ['key1', timer1],
          ['key2', timer2],
        ]),
      });
      const store = createMorselStore(state, 'frozen');

      await store.stop();

      expect(clearTimeoutSpy).toHaveBeenCalledWith(timer1);
      expect(clearTimeoutSpy).toHaveBeenCalledWith(timer2);
      expect(state.debounceTimers.size).toBe(0);
      clearTimeoutSpy.mockRestore();
    });

    it('calls dispose on hooks with dispose defined', async () => {
      const dispose = vi.fn();
      const state = createState({
        options: {
          hooks: [
            {
              name: 'test',
              lifecycle: 'before:defaults',
              load: () => ({}),
              dispose,
            },
          ],
        } as never,
      });
      const store = createMorselStore(state, 'frozen');

      await store.stop();

      expect(dispose).toHaveBeenCalledTimes(1);
    });

    it('skips dispose for EventHook (after:write)', async () => {
      const dispose = vi.fn();
      const state = createState({
        options: {
          hooks: [
            {
              name: 'audit',
              lifecycle: 'after:write',
              onWrite: vi.fn(),
              dispose,
            },
          ],
        } as never,
      });
      const store = createMorselStore(state, 'frozen');

      await store.stop();

      expect(dispose).not.toHaveBeenCalled();
    });

    it('skips dispose when not defined on hook', async () => {
      const state = createState({
        options: {
          hooks: [
            {
              name: 'no-dispose',
              lifecycle: 'before:defaults',
              load: () => ({}),
            },
          ],
        } as never,
      });
      const store = createMorselStore(state, 'frozen');

      await expect(store.stop()).resolves.toBeUndefined();
    });

    it('logs dispose errors via onDebug without throwing', async () => {
      const onDebug = vi.fn();
      const state = createState({
        options: {
          hooks: [
            {
              name: 'failing',
              lifecycle: 'before:defaults',
              load: () => ({}),
              dispose: () => {
                throw new Error('cleanup failed');
              },
            },
          ],
          onDebug,
        } as never,
      });
      const store = createMorselStore(state, 'frozen');

      await expect(store.stop()).resolves.toBeUndefined();
      expect(onDebug).toHaveBeenCalledWith(
        'hook "failing" failed in dispose: cleanup failed',
        { hookName: 'failing' },
      );
    });
  });

  describe('get', () => {
    it('returns value by dotted path', () => {
      const state = createState({
        _config: { server: { port: 3000 } } as never,
      });
      const store = createMorselStore(state, 'mutable');

      expect(store.get('server.port')).toBe(3000);
    });

    it('returns default value for missing path', () => {
      const state = createState({ _config: { server: {} } as never });
      const store = createMorselStore(state, 'mutable');

      expect(store.get('server.host', 'fallback')).toBe('fallback');
    });
  });

  describe('has', () => {
    it.each([
      {
        config: { server: { port: 3000 } },
        path: 'server.port',
        expected: true,
      },
      { config: { server: {} }, path: 'server.host', expected: false },
    ])('returns $expected for $path', ({ config, path, expected }) => {
      const state = createState({ _config: config as never });
      const store = createMorselStore(state, 'mutable');

      expect(store.has(path)).toBe(expected);
    });
  });

  describe('all', () => {
    it('returns a deep clone of the config', () => {
      const config = { server: { port: 3000 } } as never;
      const state = createState({ _config: config });
      const store = createMorselStore(state, 'mutable');

      const snapshot = store.all();

      expect(snapshot).toEqual(config);
      expect(snapshot).not.toBe(config);
      expect((snapshot as Record<string, unknown>)['server']).not.toBe(
        (config as Record<string, unknown>)['server'],
      );
    });
  });

  describe('dotify', () => {
    it('flattens nested config to 1D dotted record', () => {
      const state = createState({
        _config: { server: { port: 3000, host: 'localhost' } } as never,
      });
      const store = createMorselStore(state, 'mutable');

      expect(store.dotify()).toEqual({
        'server.port': 3000,
        'server.host': 'localhost',
      });
    });
  });

  describe('set', () => {
    it('delegates to mutateKey with path, value, and target', async () => {
      vi.mocked(mutateKey).mockResolvedValue(undefined);
      const state = createState();
      const store = createMorselStore(state, 'mutable');

      await store.set('server.port', 8080, 'project');

      expect(mutateKey).toHaveBeenCalledWith(
        state,
        'server.port',
        8080,
        'project',
        'mutable',
      );
    });
  });

  describe('unset', () => {
    it('delegates to deleteKey with path and target', async () => {
      vi.mocked(deleteKey).mockResolvedValue(true);
      const state = createState();
      const store = createMorselStore(state, 'mutable');

      const result = await store.unset('server.port', 'all');

      expect(result).toBe(true);
      expect(deleteKey).toHaveBeenCalledWith(
        state,
        'server.port',
        'all',
        'mutable',
      );
    });
  });

  describe('mutateKey', () => {
    it('calls mutateKeyMutator with state, path, value, target, and mutability', async () => {
      vi.mocked(mutateKey).mockResolvedValue(undefined);
      const state = createState();
      const store = createMorselStore(state, 'frozen');

      await store.mutateKey('server.port', 8080, 'project');

      expect(mutateKey).toHaveBeenCalledWith(
        state,
        'server.port',
        8080,
        'project',
        'frozen',
      );
    });
  });

  describe('deleteKey', () => {
    it('calls deleteKeyMutator with state, path, target, and mutability', async () => {
      vi.mocked(deleteKey).mockResolvedValue(false);
      const state = createState();
      const store = createMorselStore(state, 'frozen');

      const result = await store.deleteKey('server.port', 'global');

      expect(result).toBe(false);
      expect(deleteKey).toHaveBeenCalledWith(
        state,
        'server.port',
        'global',
        'frozen',
      );
    });
  });

  describe('push', () => {
    it('delegates to pushKey with state, path, value, target, and mutability', async () => {
      vi.mocked(pushKey).mockResolvedValue(2);
      const state = createState();
      const store = createMorselStore(state, 'frozen');

      const result = await store.push('tags', 'new', 'project');

      expect(result).toBe(2);
      expect(pushKey).toHaveBeenCalledWith(
        state,
        'tags',
        'new',
        'project',
        'frozen',
      );
    });
  });

  describe('unshift', () => {
    it('delegates to unshiftKey with state, path, value, target, and mutability', async () => {
      vi.mocked(unshiftKey).mockResolvedValue(0);
      const state = createState();
      const store = createMorselStore(state, 'frozen');

      const result = await store.unshift('tags', 'new');

      expect(result).toBe(0);
      expect(unshiftKey).toHaveBeenCalledWith(
        state,
        'tags',
        'new',
        undefined,
        'frozen',
      );
    });
  });

  describe('pop and shift', () => {
    it.each([
      {
        name: 'pop',
        fn: popKey,
        call: (s: ReturnType<typeof createMorselStore>) => s.pop('tags'),
      },
      {
        name: 'shift',
        fn: shiftKey,
        call: (s: ReturnType<typeof createMorselStore>) => s.shift('tags'),
      },
    ])(
      'delegates to $name with state, path, target, and mutability',
      async ({ fn, call }) => {
        vi.mocked(fn).mockResolvedValue('removed');
        const state = createState();
        const store = createMorselStore(state, 'frozen');

        const result = await call(store);

        expect(result).toBe('removed');
        expect(fn).toHaveBeenCalledWith(state, 'tags', undefined, 'frozen');
      },
    );
  });

  describe('splice', () => {
    it('delegates to spliceKey with state, path, start, deleteCount, items, and mutability', async () => {
      vi.mocked(spliceKey).mockResolvedValue(['removed']);
      const state = createState();
      const store = createMorselStore(state, 'frozen');

      const result = await store.splice('tags', 1, 2, 'a', 'b');

      expect(result).toEqual(['removed']);
      expect(spliceKey).toHaveBeenCalledWith(
        state,
        'tags',
        1,
        2,
        ['a', 'b'],
        undefined,
        'frozen',
      );
    });
  });

  describe('indexOf and lastIndexOf', () => {
    it.each([
      {
        method: 'indexOf' as const,
        config: { tags: ['a', 'b', 'a'] },
        path: 'tags',
        value: 'a',
        expected: 0,
      },
      {
        method: 'indexOf' as const,
        config: { tags: ['a', 'b'] },
        path: 'tags',
        value: 'z',
        expected: -1,
      },
      {
        method: 'indexOf' as const,
        config: { name: 'morsel' },
        path: 'name',
        value: 'morsel',
        expected: -1,
      },
      {
        method: 'lastIndexOf' as const,
        config: { tags: ['a', 'b', 'a'] },
        path: 'tags',
        value: 'a',
        expected: 2,
      },
      {
        method: 'lastIndexOf' as const,
        config: { tags: ['a', 'b'] },
        path: 'tags',
        value: 'z',
        expected: -1,
      },
      {
        method: 'lastIndexOf' as const,
        config: { name: 'morsel' },
        path: 'name',
        value: 'morsel',
        expected: -1,
      },
    ])(
      '$method returns $expected for $path with value $value',
      ({ method, config, path, value, expected }) => {
        const state = createState({
          _config: config as never,
        });
        const store = createMorselStore(state, 'frozen');

        const result =
          method === 'indexOf'
            ? store.indexOf(path, value)
            : store.lastIndexOf(path, value);

        expect(result).toBe(expected);
      },
    );
  });

  describe('proxy initialization', () => {
    it('creates stable proxy on initialization', () => {
      const state = createState();

      createMorselStore(state, 'frozen');

      expect(createStableProxy).toHaveBeenCalledWith(state, 'frozen');
    });

    it('assigns proxy to state._proxy', () => {
      const state = createState();
      const proxyValue = { proxied: true } as never;
      vi.mocked(createStableProxy).mockReturnValue(proxyValue);

      createMorselStore(state, 'frozen');

      expect(state._proxy).toBe(proxyValue);
    });
  });
});
