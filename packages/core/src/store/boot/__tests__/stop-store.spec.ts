import { stopStore } from '@/store/boot/stop-store';
import type { StoreState } from '@/store/store-state';
import { releaseWatcher } from '@/watch/watcher-registry';

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
    options: { hooks: [], onDebug: vi.fn() } as never,
    lastConfig: {},
    remergeInProgress: false,
    remergeDone: undefined,
    pendingRemerge: false,
    debounceTimers: new Map(),
    debounceMs: 300,
    remerge: vi.fn(),
    enoentLogged: new Set(),
    writeQueue: Promise.resolve(),
    ...overrides,
  } as StoreState<T>;
}

describe('stop-store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets stopped to true', async () => {
    const state = createState();

    await stopStore(state);

    expect(state.stopped).toBe(true);
  });

  it('returns early when already stopped without releasing watchers', async () => {
    const state = createState({
      stopped: true,
      watchers: new Set(['/dir1', '/dir2']),
    });

    await stopStore(state);

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

    await stopStore(state);

    expect(isResolved).toBe(true);
  });

  it('releases all watchers', async () => {
    const state = createState({
      watchers: new Set(['/dir1', '/dir2']),
    });

    await stopStore(state);

    expect(releaseWatcher).toHaveBeenCalledTimes(2);
    expect(releaseWatcher).toHaveBeenCalledWith('/dir1', state);
    expect(releaseWatcher).toHaveBeenCalledWith('/dir2', state);
  });

  it('clears watchers set', async () => {
    const state = createState({
      watchers: new Set(['/dir1']),
    });

    await stopStore(state);

    expect(state.watchers.size).toBe(0);
  });

  it('clears listeners and wildcardListeners maps', async () => {
    const state = createState();
    state.listeners.set('foo', new Set([vi.fn()]));
    state.wildcardListeners.set('**', new Set([vi.fn()]));

    await stopStore(state);

    expect(state.listeners.size).toBe(0);
    expect(state.wildcardListeners.size).toBe(0);
  });

  it('does not await remergeDone when undefined', async () => {
    const state = createState({ remergeDone: undefined });

    await stopStore(state);

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

    await stopStore(state);

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

    await stopStore(state);

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

    await stopStore(state);

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

    await expect(stopStore(state)).resolves.toBeUndefined();
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

    await expect(stopStore(state)).resolves.toBeUndefined();
    expect(onDebug).toHaveBeenCalledWith(
      'hook "failing" failed in dispose: cleanup failed',
      { hookName: 'failing' },
    );
  });
});
