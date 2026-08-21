import { applyMutability } from '@/load/merge-layers';
import { createMorselStore } from '@/store/morsel-store';
import { createStableProxy } from '@/store/stable-proxy';
import type { StoreState } from '@/store/store-state';
import { releaseWatcher } from '@/watch/watcher-registry';

vi.mock('@/load/merge-layers', () => ({
  applyMutability: vi.fn(),
}));
vi.mock('@/store/stable-proxy', () => ({
  createStableProxy: vi.fn(),
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
    stopped: false,
    watchers: new Set(),
    watchedFiles: new Map(),
    projectPath: '/project/config.json',
    options: {} as never,
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

    it('clears listeners map', async () => {
      const state = createState();
      state.listeners.set('foo', new Set([vi.fn()]));
      const store = createMorselStore(state, 'frozen');

      await store.stop();

      expect(state.listeners.size).toBe(0);
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
