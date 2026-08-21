import path from 'node:path';

import { handleWatchEvent } from '@/watch/handle-event';
import type { WatcherEntry } from '@/watch/watcher-registry';

type RemergeFunction = (store: MockStore) => Promise<void>;

interface MockStore {
  watchedFiles: Map<string, Set<string>>;
  projectPath: string;
  stopped: boolean;
  pendingRemerge: boolean;
  debounceTimers: Map<string, NodeJS.Timeout>;
  debounceMs: number;
  remerge: RemergeFunction;
}

function filesMap(files: string[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const file of files) {
    const resolved = path.resolve(file);
    const directory = path.dirname(resolved);
    const base = path.basename(resolved);
    let set = map.get(directory);
    if (set === undefined) {
      set = new Set();
      map.set(directory, set);
    }
    set.add(base);
  }
  return map;
}

function createStore(overrides: Partial<MockStore> = {}): MockStore {
  return {
    watchedFiles: new Map(),
    projectPath: '/project/myapp.config.json',
    stopped: false,
    pendingRemerge: false,
    debounceTimers: new Map(),
    debounceMs: 300,
    remerge: vi.fn() as RemergeFunction,
    ...overrides,
  };
}

function createEntry(overrides: Partial<WatcherEntry> = {}): WatcherEntry {
  return {
    watcher: { close: vi.fn() } as never,
    refCount: 1,
    stores: new Set(),
    retryTimer: undefined,
    ...overrides,
  } as WatcherEntry;
}

describe('handleWatchEvent', () => {
  let registry: Map<string, WatcherEntry>;

  beforeEach(() => {
    vi.useFakeTimers();
    registry = new Map();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns early when directory is not in registry', () => {
    const remerge = vi.fn() as RemergeFunction;
    const store = createStore({ remerge });
    const entry = createEntry({
      stores: new Set([store as never]),
    });
    registry.set('/other', entry);

    handleWatchEvent(registry, '/not-watched', 'file.json');

    expect(remerge).not.toHaveBeenCalled();
  });

  it('does not call clearTimeout on first event when no existing timer', () => {
    const remerge = vi.fn() as RemergeFunction;
    const store = createStore({
      watchedFiles: filesMap(['/project/myapp.config.json']),
      remerge,
    });
    const entry = createEntry({
      stores: new Set([store as never]),
    });
    registry.set('/project', entry);
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    handleWatchEvent(registry, '/project', 'myapp.config.json');

    expect(clearTimeoutSpy).not.toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('triggers remerge for matching filename via debounce', () => {
    const remerge = vi.fn() as RemergeFunction;
    const store = createStore({
      watchedFiles: filesMap(['/project/myapp.config.json']),
      remerge,
    });
    const entry = createEntry({
      stores: new Set([store as never]),
    });
    registry.set('/project', entry);

    handleWatchEvent(registry, '/project', 'myapp.config.json');

    expect(remerge).not.toHaveBeenCalled();
    expect(store.debounceTimers.size).toBe(1);

    vi.advanceTimersByTime(300);

    expect(remerge).toHaveBeenCalledTimes(1);
    expect(remerge).toHaveBeenCalledWith(store);
    expect(store.debounceTimers.size).toBe(0);
  });

  it('skips stores that do not watch the file', () => {
    const remerge = vi.fn() as RemergeFunction;
    const store = createStore({
      watchedFiles: filesMap(['/project/other.config.json']),
      remerge,
    });
    const entry = createEntry({
      stores: new Set([store as never]),
    });
    registry.set('/project', entry);

    handleWatchEvent(registry, '/project', 'myapp.config.json');

    vi.advanceTimersByTime(300);
    expect(remerge).not.toHaveBeenCalled();
  });

  it('skips stores with no entry for the directory in watchedFiles', () => {
    const remerge = vi.fn() as RemergeFunction;
    const store = createStore({
      watchedFiles: filesMap(['/other/base.json']),
      remerge,
    });
    const entry = createEntry({
      stores: new Set([store as never]),
    });
    registry.set('/project', entry);

    handleWatchEvent(registry, '/project', 'myapp.config.json');

    vi.advanceTimersByTime(300);
    expect(remerge).not.toHaveBeenCalled();
  });

  it('debounces multiple events for same file — only last fires', () => {
    const remerge = vi.fn() as RemergeFunction;
    const store = createStore({
      watchedFiles: filesMap(['/project/myapp.config.json']),
      remerge,
    });
    const entry = createEntry({
      stores: new Set([store as never]),
    });
    registry.set('/project', entry);

    handleWatchEvent(registry, '/project', 'myapp.config.json');
    handleWatchEvent(registry, '/project', 'myapp.config.json');
    handleWatchEvent(registry, '/project', 'myapp.config.json');

    expect(store.debounceTimers.size).toBe(1);

    vi.advanceTimersByTime(300);

    expect(remerge).toHaveBeenCalledTimes(1);
  });

  it('clears existing debounce timer when new event arrives', () => {
    const remerge = vi.fn() as RemergeFunction;
    const store = createStore({
      watchedFiles: filesMap(['/project/myapp.config.json']),
      remerge,
    });
    const entry = createEntry({
      stores: new Set([store as never]),
    });
    registry.set('/project', entry);

    handleWatchEvent(registry, '/project', 'myapp.config.json');
    const firstTimer = store.debounceTimers.values().next().value;
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    handleWatchEvent(registry, '/project', 'myapp.config.json');

    expect(clearTimeoutSpy).toHaveBeenCalledWith(firstTimer);
    clearTimeoutSpy.mockRestore();
  });

  it('handles multiple stores watching same file — both get remerge', () => {
    const remerge1 = vi.fn() as RemergeFunction;
    const remerge2 = vi.fn() as RemergeFunction;
    const store1 = createStore({
      watchedFiles: filesMap(['/project/myapp.config.json']),
      projectPath: '/project/store1.config.json',
      remerge: remerge1,
    });
    const store2 = createStore({
      watchedFiles: filesMap(['/project/myapp.config.json']),
      projectPath: '/project/store2.config.json',
      remerge: remerge2,
    });
    const entry = createEntry({
      stores: new Set([store1 as never, store2 as never]),
    });
    registry.set('/project', entry);

    handleWatchEvent(registry, '/project', 'myapp.config.json');

    expect(store1.debounceTimers.size).toBe(1);
    expect(store2.debounceTimers.size).toBe(1);

    vi.advanceTimersByTime(300);

    expect(remerge1).toHaveBeenCalledTimes(1);
    expect(remerge2).toHaveBeenCalledTimes(1);
    expect(remerge1).toHaveBeenCalledWith(store1);
    expect(remerge2).toHaveBeenCalledWith(store2);
  });

  it('uses unique debounce key per file and store projectPath', () => {
    const remerge = vi.fn() as RemergeFunction;
    const store = createStore({
      watchedFiles: filesMap(['/project/myapp.config.json']),
      projectPath: '/project/myapp.config.json',
      remerge,
    });
    const entry = createEntry({
      stores: new Set([store as never]),
    });
    registry.set('/project', entry);

    handleWatchEvent(registry, '/project', 'myapp.config.json');

    const debounceKey = `${path.resolve('/project', 'myapp.config.json')}:${store.projectPath}`;
    expect(store.debounceTimers.has(debounceKey)).toBe(true);
  });

  describe('undefined filename', () => {
    it('does not call clearTimeout on first event when no existing timer', () => {
      const remerge = vi.fn() as RemergeFunction;
      const store = createStore({
        watchedFiles: filesMap(['/project/myapp.config.json']),
        remerge,
      });
      const entry = createEntry({
        stores: new Set([store as never]),
      });
      registry.set('/project', entry);
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

      handleWatchEvent(registry, '/project', undefined);

      expect(clearTimeoutSpy).not.toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it('triggers remerge for stores with files in the directory', () => {
      const remerge = vi.fn() as RemergeFunction;
      const store = createStore({
        watchedFiles: filesMap([
          '/project/myapp.config.json',
          '/other/base.json',
        ]),
        remerge,
      });
      const entry = createEntry({
        stores: new Set([store as never]),
      });
      registry.set('/project', entry);

      handleWatchEvent(registry, '/project', undefined);

      expect(remerge).not.toHaveBeenCalled();
      expect(store.debounceTimers.size).toBe(1);

      vi.advanceTimersByTime(300);

      expect(remerge).toHaveBeenCalledTimes(1);
      expect(remerge).toHaveBeenCalledWith(store);
      expect(store.debounceTimers.size).toBe(0);
    });

    it('skips stores with no files in the directory', () => {
      const remerge = vi.fn() as RemergeFunction;
      const store = createStore({
        watchedFiles: filesMap(['/other/base.json']),
        remerge,
      });
      const entry = createEntry({
        stores: new Set([store as never]),
      });
      registry.set('/project', entry);

      handleWatchEvent(registry, '/project', undefined);

      vi.advanceTimersByTime(300);
      expect(remerge).not.toHaveBeenCalled();
    });

    it('skips stores with empty basenames set for the directory', () => {
      const remerge = vi.fn() as RemergeFunction;
      const store = createStore({
        watchedFiles: new Map([['/project', new Set<string>()]]),
        remerge,
      });
      const entry = createEntry({
        stores: new Set([store as never]),
      });
      registry.set('/project', entry);

      handleWatchEvent(registry, '/project', undefined);

      vi.advanceTimersByTime(300);
      expect(remerge).not.toHaveBeenCalled();
    });

    it('debounces multiple undefined-filename events', () => {
      const remerge = vi.fn() as RemergeFunction;
      const store = createStore({
        watchedFiles: filesMap(['/project/myapp.config.json']),
        remerge,
      });
      const entry = createEntry({
        stores: new Set([store as never]),
      });
      registry.set('/project', entry);

      handleWatchEvent(registry, '/project', undefined);
      handleWatchEvent(registry, '/project', undefined);

      expect(store.debounceTimers.size).toBe(1);

      vi.advanceTimersByTime(300);

      expect(remerge).toHaveBeenCalledTimes(1);
    });

    it('uses wildcard debounce key for undefined filename', () => {
      const remerge = vi.fn() as RemergeFunction;
      const store = createStore({
        watchedFiles: filesMap(['/project/myapp.config.json']),
        projectPath: '/project/myapp.config.json',
        remerge,
      });
      const entry = createEntry({
        stores: new Set([store as never]),
      });
      registry.set('/project', entry);

      handleWatchEvent(registry, '/project', undefined);

      const debounceKey = `/project:*:${store.projectPath}`;
      expect(store.debounceTimers.has(debounceKey)).toBe(true);
    });

    it('handles multiple stores in undefined-filename mode', () => {
      const remerge1 = vi.fn() as RemergeFunction;
      const remerge2 = vi.fn() as RemergeFunction;
      const store1 = createStore({
        watchedFiles: filesMap(['/project/myapp.config.json']),
        projectPath: '/project/s1.json',
        remerge: remerge1,
      });
      const store2 = createStore({
        watchedFiles: filesMap(['/project/base.json']),
        projectPath: '/project/s2.json',
        remerge: remerge2,
      });
      const entry = createEntry({
        stores: new Set([store1 as never, store2 as never]),
      });
      registry.set('/project', entry);

      handleWatchEvent(registry, '/project', undefined);

      expect(store1.debounceTimers.size).toBe(1);
      expect(store2.debounceTimers.size).toBe(1);

      vi.advanceTimersByTime(300);

      expect(remerge1).toHaveBeenCalledTimes(1);
      expect(remerge2).toHaveBeenCalledTimes(1);
    });
  });
});
