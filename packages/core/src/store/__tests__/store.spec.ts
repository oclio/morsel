import { createMockStoreState } from '@oclio/test-helpers';

import { applyMutability } from '@/load/merge-layers';
import { stopStore } from '@/store/boot/stop-store';
import { emitChanges } from '@/store/reactive/emit-changes';
import { createStableProxy } from '@/store/reactive/stable-proxy';
import { createMorselStore } from '@/store/store';
import { deleteKey, mutateKey, setKey, unsetKey } from '@/store/store-mutator';
import { resolveProvenance } from '@/store/store-provenance';
import type { StoreState } from '@/store/store-state';
import { runTransaction } from '@/store/store-transaction';

vi.mock('@/load/merge-layers', () => ({
  applyMutability: vi.fn(),
}));
vi.mock('@/store/boot/stop-store', () => ({
  stopStore: vi.fn(),
}));
vi.mock('@/store/reactive/stable-proxy', () => ({
  createStableProxy: vi.fn(),
}));
vi.mock('@/store/store-mutator', () => ({
  deleteKey: vi.fn(),
  mutateKey: vi.fn(),
  setKey: vi.fn(),
  unsetKey: vi.fn(),
}));
vi.mock('@/store/store-provenance', () => ({
  resolveProvenance: vi.fn(),
}));
vi.mock('@/store/store-transaction', () => ({
  runTransaction: vi.fn(),
}));

function createState<T extends Record<string, unknown>>(
  overrides: Partial<StoreState<T>> = {},
): StoreState<T> {
  return createMockStoreState<T>({
    _config: { foo: 'bar' } as unknown as T,
    options: { hooks: [], proxy: true },
    ...overrides,
  }) as unknown as StoreState<T>;
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

  describe('proxy: false', () => {
    it('does not call createStableProxy when proxy is false', () => {
      const state = createState({
        options: { hooks: [], proxy: false } as never,
      });

      createMorselStore(state, 'frozen');

      expect(createStableProxy).not.toHaveBeenCalled();
    });

    it('returns state._config directly when proxy is false', () => {
      const config = { foo: 'bar' } as never;
      const state = createState({
        _config: config,
        options: { hooks: [], proxy: false } as never,
      });

      const store = createMorselStore(state, 'frozen');

      expect(store.config).toBe(config);
    });

    it('returns state._config when proxy is false and stopped', () => {
      const config = { foo: 'bar' } as never;
      const state = createState({
        _config: config,
        stopped: true,
        _stoppedConfig: undefined,
        options: { hooks: [], proxy: false } as never,
      });
      vi.mocked(applyMutability).mockReturnValue(config);

      const store = createMorselStore(state, 'frozen');

      expect(store.config).toEqual(config);
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
    it('delegates to stopStore with state', async () => {
      vi.mocked(stopStore).mockResolvedValue(undefined);
      const state = createState();
      const store = createMorselStore(state, 'frozen');

      await store.stop();

      expect(stopStore).toHaveBeenCalledWith(state);
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
    it('delegates to setKey with path, value, and target', async () => {
      vi.mocked(setKey).mockResolvedValue(undefined);
      const state = createState();
      const store = createMorselStore(state, 'mutable');

      await store.set('server.port', 8080, 'project');

      expect(setKey).toHaveBeenCalledWith(
        state,
        'server.port',
        8080,
        'project',
        'mutable',
      );
    });
  });

  describe('unset', () => {
    it('delegates to unsetKey with path and target', async () => {
      vi.mocked(unsetKey).mockResolvedValue(true);
      const state = createState();
      const store = createMorselStore(state, 'mutable');

      const result = await store.unset('server.port', 'all');

      expect(result).toBe(true);
      expect(unsetKey).toHaveBeenCalledWith(
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

  describe('getProvenance', () => {
    it('delegates to resolveProvenance with layers and path', () => {
      const layers = [
        { source: 'defaults', path: undefined, config: {}, exists: true },
      ];
      const state = createState({ _layers: layers as never });
      vi.mocked(resolveProvenance).mockReturnValue({
        value: 3000,
        source: 'defaults',
        file: undefined,
        overridden: [],
      } as never);
      const store = createMorselStore(state, 'frozen');

      const result = store.getProvenance('server.port');

      expect(resolveProvenance).toHaveBeenCalledWith(layers, 'server.port');
      expect(result).toEqual({
        value: 3000,
        source: 'defaults',
        file: undefined,
        overridden: [],
      });
    });
  });

  describe('transaction', () => {
    it('delegates to runTransaction with state, mutability, and callback', async () => {
      const state = createState();
      const store = createMorselStore(state, 'frozen');
      const callback = vi.fn(async () => {});

      await store.transaction(callback);

      expect(runTransaction).toHaveBeenCalledWith(state, 'frozen', callback);
    });
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
