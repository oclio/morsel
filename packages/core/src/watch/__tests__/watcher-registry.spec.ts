import { existsSync, watch } from 'node:fs';

import { createMockStoreState } from '@oclio/test-helpers';

import type { DebugCallback } from '@/load/resolve-env';
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
  return createMockStoreState({
    watchedFiles: map,
    projectPath: '/fake/myapp.config.json',
    options: {
      verbose: false,
      onDebug: vi.fn(),
      ...optionsOverride,
    },
  }) as StoreState;
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

  it('clears retryTimer when releasing a watcher in recovery', () => {
    vi.useFakeTimers();
    vi.mocked(existsSync).mockReturnValue(false);
    const store = createMockStore(['/missing/dir/myapp.config.json']);

    const entry = createWatcher('/missing/dir', store);
    expect(entry.retryTimer).toBeDefined();
    const timer = entry.retryTimer;

    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    releaseWatcher('/missing/dir', store);

    expect(clearTimeoutSpy).toHaveBeenCalledWith(timer);
    expect(entry.retryTimer).toBeUndefined();
    expect(getRegistry().has('/missing/dir')).toBe(false);
    clearTimeoutSpy.mockRestore();
    vi.mocked(existsSync).mockReturnValue(true);
    vi.useRealTimers();
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

  it('clears retryTimer for entries in recovery', () => {
    vi.useFakeTimers();
    vi.mocked(existsSync).mockReturnValue(false);
    const store = createMockStore(['/missing/dir/myapp.config.json']);

    const entry = createWatcher('/missing/dir', store);
    expect(entry.retryTimer).toBeDefined();
    const timer = entry.retryTimer;

    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    clearRegistry();

    expect(clearTimeoutSpy).toHaveBeenCalledWith(timer);
    expect(getRegistry().size).toBe(0);
    clearTimeoutSpy.mockRestore();
    vi.mocked(existsSync).mockReturnValue(true);
    vi.useRealTimers();
  });
});
