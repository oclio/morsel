import { existsSync, watch } from 'node:fs';

import type { DebugCallback } from '@/load/resolve-env';
import { noop } from '@/store/assert-name';
import type { StoreState } from '@/store/store-state';
import {
  clearRegistry,
  createWatcher,
  getRegistry,
  releaseWatcher,
} from '@/watch/watcher-registry';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  watch: vi.fn(),
}));

function createMockWatcher(): {
  close: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
} {
  return { close: vi.fn(), on: vi.fn() };
}

function createMockStore(
  watchedFiles: string[] = [],
  optionsOverride: {
    verbose?: boolean;
    onDebug?: DebugCallback;
  } = {},
): StoreState {
  const map = new Map<string, Set<string>>();
  for (const file of watchedFiles) {
    const directory = file.slice(0, Math.max(0, file.lastIndexOf('/')));
    const base = file.slice(Math.max(0, file.lastIndexOf('/') + 1));
    let set = map.get(directory);
    if (set === undefined) {
      set = new Set();
      map.set(directory, set);
    }
    set.add(base);
  }
  return {
    _config: {},
    _proxy: undefined,
    _stoppedConfig: undefined,
    _layers: [],
    listeners: new Map(),
    stopped: false,
    watchers: new Set(),
    watchedFiles: map,
    projectPath: '/fake/myapp.config.json',
    options: {
      verbose: false,
      onDebug: vi.fn(),
      ...optionsOverride,
    } as never,
    lastConfig: {},
    remergeInProgress: false,
    remergeDone: undefined,
    pendingRemerge: false,
    debounceTimers: new Map(),
    debounceMs: 300,
    remerge: vi.fn(),
    enoentLogged: new Set(),
  };
}

describe('createWatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(existsSync).mockReturnValue(true);
    clearRegistry();
  });

  it('creates a new watcher entry when directory is not watched', () => {
    const mockWatcher = createMockWatcher();
    vi.mocked(watch).mockReturnValue(mockWatcher as never);
    const store = createMockStore(['/fake/dir/myapp.config.json']);

    const entry = createWatcher('/fake/dir', store);

    expect(watch).toHaveBeenCalledWith('/fake/dir', expect.any(Function));
    expect(entry.refCount).toBe(1);
    expect(entry.stores.has(store)).toBe(true);
    expect(getRegistry().get('/fake/dir')).toBe(entry);
  });

  it('increments refCount and adds store when directory is already watched', () => {
    const mockWatcher = createMockWatcher();
    vi.mocked(watch).mockReturnValue(mockWatcher as never);
    const store1 = createMockStore();
    const store2 = createMockStore();

    const entry1 = createWatcher('/shared/dir', store1);
    const entry2 = createWatcher('/shared/dir', store2);

    expect(entry1).toBe(entry2);
    expect(entry2.refCount).toBe(2);
    expect(entry2.stores.has(store1)).toBe(true);
    expect(entry2.stores.has(store2)).toBe(true);
    expect(watch).toHaveBeenCalledTimes(1);
  });

  it('starts recovery instead of watching when directory does not exist at boot', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const store = createMockStore(['/missing/dir/myapp.config.json']);

    const entry = createWatcher('/missing/dir', store);

    expect(watch).not.toHaveBeenCalled();
    expect(entry.watcher).toBeUndefined();
    expect(entry.retryTimer).toBeDefined();
  });
});

describe('releaseWatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(existsSync).mockReturnValue(true);
    clearRegistry();
  });

  it('decrements refCount and keeps watcher when other stores remain', () => {
    const mockWatcher = createMockWatcher();
    vi.mocked(watch).mockReturnValue(mockWatcher as never);
    const store1 = createMockStore();
    const store2 = createMockStore();

    createWatcher('/shared/dir', store1);
    createWatcher('/shared/dir', store2);

    releaseWatcher('/shared/dir', store1);

    const entry = getRegistry().get('/shared/dir');
    expect(entry?.refCount).toBe(1);
    expect(entry?.stores.has(store1)).toBe(false);
    expect(entry?.stores.has(store2)).toBe(true);
    expect(mockWatcher.close).not.toHaveBeenCalled();
  });

  it('closes watcher and removes entry when refCount reaches zero', () => {
    const mockWatcher = createMockWatcher();
    vi.mocked(watch).mockReturnValue(mockWatcher as never);
    const store = createMockStore();

    createWatcher('/single/dir', store);

    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    releaseWatcher('/single/dir', store);

    expect(mockWatcher.close).toHaveBeenCalledTimes(1);
    expect(getRegistry().has('/single/dir')).toBe(false);
    expect(clearTimeoutSpy).not.toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('does nothing when directory is not in registry', () => {
    const store = createMockStore();

    releaseWatcher('/unknown/dir', store);

    expect(getRegistry().size).toBe(0);
  });
});

describe('handleWatchEvent (via watch callback)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.mocked(existsSync).mockReturnValue(true);
    clearRegistry();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('triggers remerge for matching store after debounce', async () => {
    const mockWatcher = createMockWatcher();
    vi.mocked(watch).mockReturnValue(mockWatcher as never);
    const store = createMockStore(['/fake/dir/myapp.config.json']);

    createWatcher('/fake/dir', store);

    const callback = vi.mocked(watch).mock.calls[0]?.[1];
    callback?.('change', 'myapp.config.json');

    expect(store.remerge).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);

    expect(store.remerge).toHaveBeenCalledWith(store);
  });

  it('skips stores that do not watch the changed filename', async () => {
    const mockWatcher = createMockWatcher();
    vi.mocked(watch).mockReturnValue(mockWatcher as never);
    const store = createMockStore(['/fake/dir/myapp.config.json']);

    createWatcher('/fake/dir', store);

    const callback = vi.mocked(watch).mock.calls[0]?.[1];
    callback?.('change', 'other.config.json');

    await vi.advanceTimersByTimeAsync(300);

    expect(store.remerge).not.toHaveBeenCalled();
  });

  it('triggers remerge for undefined filename when store has files in directory', async () => {
    const mockWatcher = createMockWatcher();
    vi.mocked(watch).mockReturnValue(mockWatcher as never);
    const store = createMockStore(['/fake/dir/myapp.config.json']);

    createWatcher('/fake/dir', store);

    const callback = vi.mocked(watch).mock.calls[0]?.[1];
    callback?.('change', null);

    expect(store.remerge).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);

    expect(store.remerge).toHaveBeenCalledWith(store);
  });

  it('resets debounce timer on repeated events for the same filename', async () => {
    const mockWatcher = createMockWatcher();
    vi.mocked(watch).mockReturnValue(mockWatcher as never);
    const store = createMockStore(['/fake/dir/myapp.config.json']);

    createWatcher('/fake/dir', store);

    const callback = vi.mocked(watch).mock.calls[0]?.[1];
    callback?.('change', 'myapp.config.json');
    await vi.advanceTimersByTimeAsync(200);
    callback?.('change', 'myapp.config.json');

    await vi.advanceTimersByTimeAsync(200);

    expect(store.remerge).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(100);

    expect(store.remerge).toHaveBeenCalledTimes(1);
  });

  it('triggers recovery when watch callback fires and directory does not exist', () => {
    const mockWatcher = createMockWatcher();
    vi.mocked(watch).mockReturnValue(mockWatcher as never);
    vi.mocked(existsSync).mockReturnValueOnce(true).mockReturnValue(false);
    const store = createMockStore(['/fake/dir/myapp.config.json']);

    const entry = createWatcher('/fake/dir', store);

    const callback = vi.mocked(watch).mock.calls[0]?.[1];
    callback?.('rename', '');

    expect(mockWatcher.close).toHaveBeenCalledTimes(1);
    expect(entry.retryTimer).toBeDefined();
    expect(store.remerge).not.toHaveBeenCalled();
  });
});

describe('watcher error handler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.mocked(watch).mockReset();
    vi.mocked(existsSync).mockReset();
    clearRegistry();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('closes watcher and starts polling on error', () => {
    const mockWatcher = createMockWatcher();
    vi.mocked(watch).mockReturnValue(mockWatcher as never);
    vi.mocked(existsSync).mockReturnValueOnce(true).mockReturnValue(false);
    const store = createMockStore(['/fake/dir/myapp.config.json']);

    createWatcher('/fake/dir', store);

    const errorCallback = mockWatcher.on.mock.calls.find(
      (call) => call[0] === 'error',
    )?.[1];
    errorCallback?.();

    expect(mockWatcher.close).toHaveBeenCalledTimes(1);
    expect(getRegistry().has('/fake/dir')).toBe(true);
  });

  it('does nothing when error fires while already recovering', () => {
    const mockWatcher = createMockWatcher();
    vi.mocked(watch).mockReturnValue(mockWatcher as never);
    vi.mocked(existsSync).mockReturnValueOnce(true).mockReturnValue(false);
    const store = createMockStore(['/fake/dir/myapp.config.json']);

    createWatcher('/fake/dir', store);

    const errorCallback = mockWatcher.on.mock.calls.find(
      (call) => call[0] === 'error',
    )?.[1];
    errorCallback?.();
    errorCallback?.();

    expect(mockWatcher.close).toHaveBeenCalledTimes(1);
  });

  it('polls existsSync and re-attaches watcher then calls remerge after 1000ms', () => {
    const mockWatcher = createMockWatcher();
    const mockWatcher2 = createMockWatcher();
    vi.mocked(watch)
      .mockReturnValueOnce(mockWatcher as never)
      .mockReturnValueOnce(mockWatcher2 as never);
    vi.mocked(existsSync).mockReturnValue(true);
    const store = createMockStore(['/fake/dir/myapp.config.json']);

    const entry = createWatcher('/fake/dir', store);
    expect(entry.retryTimer).toBeUndefined();

    const errorCallback = mockWatcher.on.mock.calls.find(
      (call) => call[0] === 'error',
    )?.[1];
    errorCallback?.();

    expect(entry.retryTimer).toBeDefined();

    vi.advanceTimersByTime(1000);

    expect(existsSync).toHaveBeenCalledWith('/fake/dir');
    expect(watch).toHaveBeenCalledTimes(2);
    expect(entry.retryTimer).toBeUndefined();
    expect(entry.watcher).toBe(mockWatcher2);
    expect(getRegistry().has('/fake/dir')).toBe(true);
    expect(store.remerge).toHaveBeenCalledWith(store);
  });

  it('logs re-attach message in verbose mode', () => {
    const mockWatcher = createMockWatcher();
    const mockWatcher2 = createMockWatcher();
    vi.mocked(watch)
      .mockReturnValueOnce(mockWatcher as never)
      .mockReturnValueOnce(mockWatcher2 as never);
    vi.mocked(existsSync).mockReturnValue(true);
    const store = createMockStore(['/fake/dir/myapp.config.json'], {
      verbose: true,
    });

    createWatcher('/fake/dir', store);

    const errorCallback = mockWatcher.on.mock.calls.find(
      (call) => call[0] === 'error',
    )?.[1];
    errorCallback?.();

    vi.advanceTimersByTime(1000);

    expect(store.options.onDebug).toHaveBeenCalledWith(
      'morsel: re-attaching fs.watch to /fake/dir',
      undefined,
    );
  });

  it('keeps polling when directory does not exist yet', () => {
    const mockWatcher = createMockWatcher();
    vi.mocked(watch).mockReturnValue(mockWatcher as never);
    vi.mocked(existsSync).mockReturnValueOnce(true).mockReturnValue(false);
    const store = createMockStore(['/fake/dir/myapp.config.json']);

    const entry = createWatcher('/fake/dir', store);

    const errorCallback = mockWatcher.on.mock.calls.find(
      (call) => call[0] === 'error',
    )?.[1];
    errorCallback?.();

    vi.advanceTimersByTime(1000);

    expect(existsSync).toHaveBeenCalledWith('/fake/dir');
    expect(entry.retryTimer).toBeDefined();
    expect(store.remerge).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);

    expect(existsSync).toHaveBeenCalledTimes(3);
    expect(entry.retryTimer).toBeDefined();
  });

  it('skips stopped stores during retry', () => {
    const mockWatcher = createMockWatcher();
    const mockWatcher2 = createMockWatcher();
    vi.mocked(watch)
      .mockReturnValueOnce(mockWatcher as never)
      .mockReturnValueOnce(mockWatcher2 as never);
    vi.mocked(existsSync).mockReturnValue(true);
    const store = createMockStore(['/fake/dir/myapp.config.json']);
    store.stopped = true;

    createWatcher('/fake/dir', store);

    const errorCallback = mockWatcher.on.mock.calls.find(
      (call) => call[0] === 'error',
    )?.[1];
    errorCallback?.();

    vi.advanceTimersByTime(1000);

    expect(store.remerge).not.toHaveBeenCalled();
    expect(watch).toHaveBeenCalledTimes(2);
    expect(getRegistry().has('/fake/dir')).toBe(true);
  });

  it('calls remerge for multiple non-stopped stores during retry', () => {
    const mockWatcher = createMockWatcher();
    const mockWatcher2 = createMockWatcher();
    vi.mocked(watch)
      .mockReturnValueOnce(mockWatcher as never)
      .mockReturnValueOnce(mockWatcher2 as never);
    vi.mocked(existsSync).mockReturnValue(true);
    const store1 = createMockStore(['/fake/dir/myapp.config.json']);
    const store2 = createMockStore(['/fake/dir/other.config.json']);

    createWatcher('/fake/dir', store1);
    createWatcher('/fake/dir', store2);

    const errorCallback = mockWatcher.on.mock.calls.find(
      (call) => call[0] === 'error',
    )?.[1];
    errorCallback?.();

    vi.advanceTimersByTime(1000);

    expect(store1.remerge).toHaveBeenCalledWith(store1);
    expect(store2.remerge).toHaveBeenCalledWith(store2);
  });

  it('re-polls when re-attached watcher errors again', () => {
    const mockWatcher = createMockWatcher();
    const mockWatcher2 = createMockWatcher();
    const mockWatcher3 = createMockWatcher();
    vi.mocked(watch)
      .mockReturnValueOnce(mockWatcher as never)
      .mockReturnValueOnce(mockWatcher2 as never)
      .mockReturnValueOnce(mockWatcher3 as never);
    vi.mocked(existsSync).mockReturnValue(true);
    const store = createMockStore(['/fake/dir/myapp.config.json']);

    const entry = createWatcher('/fake/dir', store);

    const errorCallback = mockWatcher.on.mock.calls.find(
      (call) => call[0] === 'error',
    )?.[1];
    errorCallback?.();

    vi.advanceTimersByTime(1000);

    const errorCallback2 = mockWatcher2.on.mock.calls.find(
      (call) => call[0] === 'error',
    )?.[1];
    errorCallback2?.();

    expect(entry.retryTimer).toBeDefined();
    expect(getRegistry().has('/fake/dir')).toBe(true);

    vi.advanceTimersByTime(1000);

    expect(watch).toHaveBeenCalledTimes(3);
    expect(entry.watcher).toBe(mockWatcher3);
    expect(store.remerge).toHaveBeenCalledTimes(2);
  });

  it('clears retryTimer on releaseWatcher during polling', () => {
    const mockWatcher = createMockWatcher();
    vi.mocked(watch).mockReturnValue(mockWatcher as never);
    vi.mocked(existsSync).mockReturnValue(false);
    const store = createMockStore(['/fake/dir/myapp.config.json']);

    const entry = createWatcher('/fake/dir', store);

    const errorCallback = mockWatcher.on.mock.calls.find(
      (call) => call[0] === 'error',
    )?.[1];
    errorCallback?.();

    vi.advanceTimersByTime(1000);

    expect(entry.retryTimer).toBeDefined();
    const timer = entry.retryTimer;

    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    releaseWatcher('/fake/dir', store);

    expect(clearTimeoutSpy).toHaveBeenCalledWith(timer);
    expect(entry.retryTimer).toBeUndefined();
    expect(getRegistry().has('/fake/dir')).toBe(false);
    clearTimeoutSpy.mockRestore();
  });

  it('clears retryTimer on clearRegistry during polling', () => {
    const mockWatcher = createMockWatcher();
    vi.mocked(watch).mockReturnValue(mockWatcher as never);
    vi.mocked(existsSync).mockReturnValue(false);
    const store = createMockStore(['/fake/dir/myapp.config.json']);

    const entry = createWatcher('/fake/dir', store);

    const errorCallback = mockWatcher.on.mock.calls.find(
      (call) => call[0] === 'error',
    )?.[1];
    errorCallback?.();

    vi.advanceTimersByTime(1000);

    const timer = entry.retryTimer;
    expect(timer).toBeDefined();

    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    clearRegistry();

    expect(clearTimeoutSpy).toHaveBeenCalledWith(timer);
    expect(getRegistry().size).toBe(0);
    clearTimeoutSpy.mockRestore();
  });

  it('stops polling when all stores are released during polling', () => {
    const mockWatcher = createMockWatcher();
    vi.mocked(watch).mockReturnValue(mockWatcher as never);
    vi.mocked(existsSync).mockReturnValue(false);
    const store = createMockStore(['/fake/dir/myapp.config.json']);

    const entry = createWatcher('/fake/dir', store);

    const errorCallback = mockWatcher.on.mock.calls.find(
      (call) => call[0] === 'error',
    )?.[1];
    errorCallback?.();

    entry.stores.delete(store);

    vi.advanceTimersByTime(1000);

    expect(entry.retryTimer).toBeUndefined();
  });

  it('dispatches events from re-attached watcher', () => {
    const mockWatcher = createMockWatcher();
    const mockWatcher2 = createMockWatcher();
    vi.mocked(watch)
      .mockReturnValueOnce(mockWatcher as never)
      .mockReturnValueOnce(mockWatcher2 as never);
    vi.mocked(existsSync).mockReturnValue(true);
    const store = createMockStore(['/fake/dir/myapp.config.json']);
    store.debounceTimers = new Map();

    createWatcher('/fake/dir', store);

    const errorCallback = mockWatcher.on.mock.calls.find(
      (call) => call[0] === 'error',
    )?.[1];
    errorCallback?.();

    vi.advanceTimersByTime(1000);

    const calls = vi.mocked(watch).mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(2);
    const secondCall = calls[1];
    if (secondCall === undefined) throw new Error('expected second watch call');
    const watchCallback = secondCall[1] as (
      eventType: string,
      filename: string | undefined,
    ) => void;

    watchCallback('change', 'myapp.config.json');

    expect(
      store.debounceTimers.has(
        '/fake/dir/myapp.config.json:/fake/myapp.config.json',
      ),
    ).toBe(true);

    store.debounceTimers.clear();
    watchCallback('change', undefined);

    expect(
      store.debounceTimers.has('/fake/dir:*:/fake/myapp.config.json'),
    ).toBe(true);
  });

  it('logs exact crash message to onDebug (not stderr) when onDebug is provided', () => {
    const mockWatcher = createMockWatcher();
    vi.mocked(watch).mockReturnValue(mockWatcher as never);
    vi.mocked(existsSync).mockReturnValue(false);
    const store = createMockStore(['/fake/dir/myapp.config.json']);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    createWatcher('/fake/dir', store);

    const errorCallback = mockWatcher.on.mock.calls.find(
      (call) => call[0] === 'error',
    )?.[1];
    errorCallback?.();

    expect(store.options.onDebug).toHaveBeenCalledWith(
      'morsel: fs.watch crashed for /fake/dir — retrying in 1s',
      undefined,
    );
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('logs exact crash message to stderr when onDebug is default noop', () => {
    const mockWatcher = createMockWatcher();
    vi.mocked(watch).mockReturnValue(mockWatcher as never);
    vi.mocked(existsSync).mockReturnValue(false);
    const store = createMockStore(['/fake/dir/myapp.config.json'], {
      onDebug: noop,
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    createWatcher('/fake/dir', store);

    const errorCallback = mockWatcher.on.mock.calls.find(
      (call) => call[0] === 'error',
    )?.[1];
    errorCallback?.();

    expect(errorSpy).toHaveBeenCalledWith(
      'morsel: fs.watch crashed for /fake/dir — retrying in 1s',
    );
    errorSpy.mockRestore();
  });

  it('does not call onDebug for stopped stores on error', () => {
    const mockWatcher = createMockWatcher();
    vi.mocked(watch).mockReturnValue(mockWatcher as never);
    vi.mocked(existsSync).mockReturnValue(false);
    const store = createMockStore(['/fake/dir/myapp.config.json']);
    store.stopped = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});

    createWatcher('/fake/dir', store);

    const errorCallback = mockWatcher.on.mock.calls.find(
      (call) => call[0] === 'error',
    )?.[1];
    errorCallback?.();

    expect(store.options.onDebug).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('does not emit re-attach log when no store is verbose', () => {
    const mockWatcher = createMockWatcher();
    const mockWatcher2 = createMockWatcher();
    vi.mocked(watch)
      .mockReturnValueOnce(mockWatcher as never)
      .mockReturnValueOnce(mockWatcher2 as never);
    vi.mocked(existsSync).mockReturnValue(true);
    const store = createMockStore(['/fake/dir/myapp.config.json']);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    createWatcher('/fake/dir', store);

    const errorCallback = mockWatcher.on.mock.calls.find(
      (call) => call[0] === 'error',
    )?.[1];
    errorCallback?.();

    vi.advanceTimersByTime(1000);

    expect(store.options.onDebug).not.toHaveBeenCalledWith(
      'morsel: re-attaching fs.watch to /fake/dir',
      undefined,
    );
    vi.restoreAllMocks();
  });

  it('does not count stopped verbose stores in hasVerbose', () => {
    const mockWatcher = createMockWatcher();
    const mockWatcher2 = createMockWatcher();
    vi.mocked(watch)
      .mockReturnValueOnce(mockWatcher as never)
      .mockReturnValueOnce(mockWatcher2 as never);
    vi.mocked(existsSync).mockReturnValue(true);
    const stoppedStore = createMockStore(['/fake/dir/myapp.config.json'], {
      verbose: true,
    });
    stoppedStore.stopped = true;
    const activeStore = createMockStore(['/fake/dir/myapp.config.json']);

    createWatcher('/fake/dir', stoppedStore);
    createWatcher('/fake/dir', activeStore);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const errorCallback = mockWatcher.on.mock.calls.find(
      (call) => call[0] === 'error',
    )?.[1];
    errorCallback?.();

    vi.advanceTimersByTime(1000);

    expect(activeStore.options.onDebug).not.toHaveBeenCalledWith(
      'morsel: re-attaching fs.watch to /fake/dir',
      undefined,
    );
    vi.restoreAllMocks();
  });

  it('logs exact still-missing message when directory does not exist', () => {
    const mockWatcher = createMockWatcher();
    vi.mocked(watch).mockReturnValue(mockWatcher as never);
    vi.mocked(existsSync).mockReturnValue(false);
    const store = createMockStore(['/fake/dir/myapp.config.json']);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    createWatcher('/fake/dir', store);

    const errorCallback = mockWatcher.on.mock.calls.find(
      (call) => call[0] === 'error',
    )?.[1];
    errorCallback?.();

    vi.advanceTimersByTime(1000);

    expect(store.options.onDebug).toHaveBeenCalledWith(
      'morsel: directory /fake/dir still missing — retrying in 1s',
      undefined,
    );
    vi.restoreAllMocks();
  });

  it('logs exact crash message when re-attached watcher errors again', () => {
    const mockWatcher = createMockWatcher();
    const mockWatcher2 = createMockWatcher();
    vi.mocked(watch)
      .mockReturnValueOnce(mockWatcher as never)
      .mockReturnValueOnce(mockWatcher2 as never);
    vi.mocked(existsSync).mockReturnValue(true);
    const onDebug = vi.fn();
    const store = createMockStore(['/fake/dir/myapp.config.json'], { onDebug });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    createWatcher('/fake/dir', store);

    const errorCallback = mockWatcher.on.mock.calls.find(
      (call) => call[0] === 'error',
    )?.[1];
    errorCallback?.();

    vi.advanceTimersByTime(1000);

    onDebug.mockClear();

    const errorCallback2 = mockWatcher2.on.mock.calls.find(
      (call) => call[0] === 'error',
    )?.[1];
    errorCallback2?.();

    expect(onDebug).toHaveBeenCalledWith(
      'morsel: fs.watch crashed for /fake/dir — retrying in 1s',
      undefined,
    );
    vi.restoreAllMocks();
  });
});

describe('getRegistry', () => {
  beforeEach(() => {
    clearRegistry();
  });

  it('returns the global registry map', () => {
    const registry = getRegistry();

    expect(registry).toBeInstanceOf(Map);
  });

  it('returns the same registry instance across calls', () => {
    const first = getRegistry();
    const second = getRegistry();

    expect(first).toBe(second);
  });
});

describe('clearRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRegistry();
  });

  it('removes all entries from the registry', () => {
    const mockWatcher = createMockWatcher();
    vi.mocked(watch).mockReturnValue(mockWatcher as never);
    const store = createMockStore();

    createWatcher('/dir1', store);
    createWatcher('/dir2', store);

    clearRegistry();

    expect(getRegistry().size).toBe(0);
  });

  it('closes all watchers and clears debounce timers', () => {
    const mockWatcher1 = createMockWatcher();
    const mockWatcher2 = createMockWatcher();
    vi.mocked(watch).mockReturnValueOnce(mockWatcher1 as never);
    vi.mocked(watch).mockReturnValueOnce(mockWatcher2 as never);
    const store = createMockStore();

    createWatcher('/dir1', store);
    createWatcher('/dir2', store);

    clearRegistry();

    expect(mockWatcher1.close).toHaveBeenCalledTimes(1);
    expect(mockWatcher2.close).toHaveBeenCalledTimes(1);
  });

  it('does not call clearTimeout when no retryTimer is active', () => {
    const mockWatcher = createMockWatcher();
    vi.mocked(watch).mockReturnValue(mockWatcher as never);
    const store = createMockStore();

    createWatcher('/dir1', store);

    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    clearRegistry();

    expect(clearTimeoutSpy).not.toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});
