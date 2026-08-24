import path from 'node:path';

import type { ResolvedLayer } from '@/load/resolve-layer';
import { jsonPlugin } from '@/plugins/json-plugin';
import type { StoreState } from '@/store/store-state';
import {
  collectWatchedFiles,
  setupWatchers,
  updateWatchedFiles,
  updateWatchers,
} from '@/store/watch/watcher-setup';
import { createWatcher, releaseWatcher } from '@/watch/watcher-registry';

vi.mock('@/watch/watcher-registry');

type ConfigRecord = Record<string, unknown>;

function makeLayer(
  source: ResolvedLayer['source'],
  options: Partial<Pick<ResolvedLayer, 'path' | 'exists' | 'extendsPaths'>> & {
    config?: ConfigRecord;
  } = {},
): ResolvedLayer {
  return {
    source,
    path: options.path,
    exists: options.exists ?? true,
    config: options.config ?? {},
    extendsPaths: options.extendsPaths ?? [],
  };
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

function hasFile(map: Map<string, Set<string>>, filePath: string): boolean {
  const resolved = path.resolve(filePath);
  const directory = path.dirname(resolved);
  const base = path.basename(resolved);
  return map.get(directory)?.has(base) ?? false;
}

function fileCount(map: Map<string, Set<string>>): number {
  let count = 0;
  for (const set of map.values()) {
    count += set.size;
  }
  return count;
}

function makeState(overrides: Partial<StoreState> = {}): StoreState {
  return {
    _config: {},
    _proxy: undefined,
    _stoppedConfig: undefined,
    _layers: [],
    listeners: new Map(),
    wildcardListeners: new Map(),
    stopped: false,
    watchers: new Set(),
    watchedFiles: new Map(),
    projectPath: '/project/myapp.config.json',
    lastConfig: {},
    remergeInProgress: false,
    remergeDone: undefined,
    pendingRemerge: false,
    debounceTimers: new Map(),
    debounceMs: 300,
    remerge: vi.fn(),
    enoentLogged: new Set(),
    options: {
      name: 'myapp',
      cwd: '/project',
      globalDir: '/global',
      formatPlugins: [jsonPlugin],
      hooks: [],
    } as never,
    ...overrides,
  } as StoreState;
}

describe('collectWatchedFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds resolved paths for layers with path and exists=true', () => {
    const state = makeState({ watchedFiles: new Map() });
    const layers = [
      makeLayer('global', { path: '/global/myapp.config.json', exists: true }),
      makeLayer('project', {
        path: '/project/myapp.config.json',
        exists: true,
      }),
    ];

    collectWatchedFiles(state, layers);

    expect(hasFile(state.watchedFiles, '/global/myapp.config.json')).toBe(true);
    expect(hasFile(state.watchedFiles, '/project/myapp.config.json')).toBe(
      true,
    );
    expect(fileCount(state.watchedFiles)).toBe(2);
  });

  it('adds layer path to watchedFiles even when path is not a candidate file', () => {
    const state = makeState({ watchedFiles: new Map() });
    const layers = [
      makeLayer('project', {
        path: '/shared/custom.config.json',
        exists: true,
      }),
    ];

    collectWatchedFiles(state, layers);

    expect(hasFile(state.watchedFiles, '/shared/custom.config.json')).toBe(
      true,
    );
    expect(fileCount(state.watchedFiles)).toBe(3);
  });

  it('skips layers with undefined path', () => {
    const state = makeState({ watchedFiles: new Map() });
    const layers = [
      makeLayer('defaults', { path: undefined, exists: true }),
      makeLayer('overrides', { path: undefined, exists: true }),
    ];

    collectWatchedFiles(state, layers);

    expect(fileCount(state.watchedFiles)).toBe(2);
    expect(hasFile(state.watchedFiles, '/project/myapp.config.json')).toBe(
      true,
    );
    expect(hasFile(state.watchedFiles, '/global/myapp.config.json')).toBe(true);
  });

  it('skips layers with exists=false', () => {
    const state = makeState({ watchedFiles: new Map() });
    const layers = [
      makeLayer('global', { path: '/global/myapp.config.json', exists: false }),
    ];

    collectWatchedFiles(state, layers);

    expect(fileCount(state.watchedFiles)).toBe(2);
    expect(hasFile(state.watchedFiles, '/project/myapp.config.json')).toBe(
      true,
    );
    expect(hasFile(state.watchedFiles, '/global/myapp.config.json')).toBe(true);
  });

  it('adds extendsPaths from all layers', () => {
    const state = makeState({ watchedFiles: new Map() });
    const layers = [
      makeLayer('project', {
        path: '/project/myapp.config.json',
        exists: true,
        extendsPaths: ['/project/base.json', '/project/shared.json'],
      }),
    ];

    collectWatchedFiles(state, layers);

    expect(hasFile(state.watchedFiles, '/project/myapp.config.json')).toBe(
      true,
    );
    expect(hasFile(state.watchedFiles, '/project/base.json')).toBe(true);
    expect(hasFile(state.watchedFiles, '/project/shared.json')).toBe(true);
    expect(fileCount(state.watchedFiles)).toBe(4);
  });

  it('adds extendsPaths even when layer path is undefined', () => {
    const state = makeState({ watchedFiles: new Map() });
    const layers = [
      makeLayer('defaults', {
        path: undefined,
        exists: true,
        extendsPaths: ['/some/extends.json'],
      }),
    ];

    collectWatchedFiles(state, layers);

    expect(hasFile(state.watchedFiles, '/some/extends.json')).toBe(true);
    expect(fileCount(state.watchedFiles)).toBe(3);
  });

  it('adds extendsPaths even when layer exists=false', () => {
    const state = makeState({ watchedFiles: new Map() });
    const layers = [
      makeLayer('global', {
        path: '/global/myapp.config.json',
        exists: false,
        extendsPaths: ['/global/base.json'],
      }),
    ];

    collectWatchedFiles(state, layers);

    expect(hasFile(state.watchedFiles, '/global/base.json')).toBe(true);
    expect(fileCount(state.watchedFiles)).toBe(3);
  });

  it('handles empty layers array', () => {
    const state = makeState({ watchedFiles: new Map() });

    collectWatchedFiles(state, []);

    expect(fileCount(state.watchedFiles)).toBe(2);
  });

  it('does not add duplicate paths', () => {
    const state = makeState({ watchedFiles: new Map() });
    const layers = [
      makeLayer('project', {
        path: '/project/myapp.config.json',
        exists: true,
        extendsPaths: ['/project/base.json'],
      }),
      makeLayer('global', {
        path: '/project/myapp.config.json',
        exists: true,
        extendsPaths: ['/project/base.json'],
      }),
    ];

    collectWatchedFiles(state, layers);

    expect(fileCount(state.watchedFiles)).toBe(3);
  });

  it('adds watchPaths from LayerWatchableHook hooks', () => {
    const state = makeState({
      watchedFiles: new Map(),
      options: {
        name: 'myapp',
        cwd: '/project',
        globalDir: '/global',
        formatPlugins: [jsonPlugin],
        hooks: [
          {
            name: 'env',
            lifecycle: 'before:defaults',
            load: () => ({}),
            watchPaths: ['/custom/env.json'],
          },
        ],
      } as never,
    });
    const layers: ResolvedLayer[] = [];

    collectWatchedFiles(state, layers);

    expect(hasFile(state.watchedFiles, '/custom/env.json')).toBe(true);
  });

  it('ignores hooks without watchPaths', () => {
    const state = makeState({
      watchedFiles: new Map(),
      options: {
        name: 'myapp',
        cwd: '/project',
        globalDir: '/global',
        formatPlugins: [jsonPlugin],
        hooks: [
          { name: 'env', lifecycle: 'before:defaults', load: () => ({}) },
        ],
      } as never,
    });
    const layers: ResolvedLayer[] = [];

    collectWatchedFiles(state, layers);

    expect(fileCount(state.watchedFiles)).toBe(2);
  });

  it('adds candidate filenames for cwd and globalDir even when no layer has a path', () => {
    const state = makeState({
      watchedFiles: new Map(),
      projectPath: undefined,
    });
    const layers = [
      makeLayer('defaults', { path: undefined, exists: true }),
      makeLayer('global', { path: undefined, exists: false }),
      makeLayer('project', { path: undefined, exists: false }),
      makeLayer('overrides', { path: undefined, exists: true }),
    ];

    collectWatchedFiles(state, layers);

    expect(hasFile(state.watchedFiles, '/project/myapp.config.json')).toBe(
      true,
    );
    expect(hasFile(state.watchedFiles, '/global/myapp.config.json')).toBe(true);
  });

  it('adds candidate filenames for all format plugin extensions', () => {
    const state = makeState({
      watchedFiles: new Map(),
      projectPath: undefined,
      options: {
        name: 'myapp',
        cwd: '/project',
        globalDir: '/global',
        formatPlugins: [
          { name: 'json', extensions: ['.json'], parse: () => ({}) },
          { name: 'yaml', extensions: ['.yaml', '.yml'], parse: () => ({}) },
        ],
        hooks: [],
      } as never,
    });
    const layers: ResolvedLayer[] = [];

    collectWatchedFiles(state, layers);

    expect(hasFile(state.watchedFiles, '/project/myapp.config.json')).toBe(
      true,
    );
    expect(hasFile(state.watchedFiles, '/project/myapp.config.yaml')).toBe(
      true,
    );
    expect(hasFile(state.watchedFiles, '/project/myapp.config.yml')).toBe(true);
    expect(hasFile(state.watchedFiles, '/global/myapp.config.json')).toBe(true);
    expect(hasFile(state.watchedFiles, '/global/myapp.config.yaml')).toBe(true);
    expect(hasFile(state.watchedFiles, '/global/myapp.config.yml')).toBe(true);
  });
});

describe('updateWatchedFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears existing watchedFiles and re-adds projectPath', () => {
    const state = makeState({
      watchedFiles: filesMap(['/old/file.json', '/another/file.json']),
    });

    updateWatchedFiles(state, []);

    expect(hasFile(state.watchedFiles, '/project/myapp.config.json')).toBe(
      true,
    );
    expect(hasFile(state.watchedFiles, '/old/file.json')).toBe(false);
    expect(fileCount(state.watchedFiles)).toBe(2);
  });

  it('rebuilds from layers after clearing', () => {
    const state = makeState({
      watchedFiles: filesMap(['/old/file.json']),
    });
    const layers = [
      makeLayer('project', {
        path: '/project/myapp.config.json',
        exists: true,
        extendsPaths: ['/project/base.json'],
      }),
    ];

    updateWatchedFiles(state, layers);

    expect(hasFile(state.watchedFiles, '/project/myapp.config.json')).toBe(
      true,
    );
    expect(hasFile(state.watchedFiles, '/project/base.json')).toBe(true);
    expect(hasFile(state.watchedFiles, '/old/file.json')).toBe(false);
    expect(fileCount(state.watchedFiles)).toBe(3);
  });

  it('handles undefined projectPath without adding to watchedFiles', () => {
    const state = makeState({
      projectPath: undefined,
      watchedFiles: filesMap(['/old/file.json']),
    });

    updateWatchedFiles(state, []);

    expect(fileCount(state.watchedFiles)).toBe(2);
  });

  it('adds projectPath to watchedFiles even when it is not a candidate file', () => {
    const state = makeState({
      projectPath: '/project/custom.config.json',
      watchedFiles: new Map(),
    });

    updateWatchedFiles(state, []);

    expect(hasFile(state.watchedFiles, '/project/custom.config.json')).toBe(
      true,
    );
    expect(fileCount(state.watchedFiles)).toBe(3);
  });
});

describe('setupWatchers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a watcher for each unique directory and adds to state.watchers', () => {
    const state = makeState();
    const layers = [
      makeLayer('global', { path: '/global/myapp.config.json', exists: true }),
      makeLayer('project', {
        path: '/project/myapp.config.json',
        exists: true,
      }),
    ];

    setupWatchers(state, layers);

    expect(createWatcher).toHaveBeenCalledTimes(2);
    expect(createWatcher).toHaveBeenCalledWith('/global', state);
    expect(createWatcher).toHaveBeenCalledWith('/project', state);
    expect(state.watchers.has('/global')).toBe(true);
    expect(state.watchers.has('/project')).toBe(true);
  });

  it('adds directory from layer path even when it is not cwd or globalDir', () => {
    const state = makeState();
    const layers = [
      makeLayer('project', {
        path: '/shared/custom.config.json',
        exists: true,
      }),
    ];

    setupWatchers(state, layers);

    expect(createWatcher).toHaveBeenCalledWith('/shared', state);
    expect(state.watchers.has('/shared')).toBe(true);
  });

  it('creates watchers for extendsPaths directories', () => {
    const state = makeState();
    const layers = [
      makeLayer('project', {
        path: '/project/myapp.config.json',
        exists: true,
        extendsPaths: ['/shared/base.json'],
      }),
    ];

    setupWatchers(state, layers);

    expect(createWatcher).toHaveBeenCalledTimes(3);
    expect(createWatcher).toHaveBeenCalledWith('/project', state);
    expect(createWatcher).toHaveBeenCalledWith('/shared', state);
    expect(createWatcher).toHaveBeenCalledWith('/global', state);
  });

  it('skips layers with undefined path', () => {
    const state = makeState();
    const layers = [
      makeLayer('defaults', { path: undefined, exists: true }),
      makeLayer('overrides', { path: undefined, exists: true }),
    ];

    setupWatchers(state, layers);

    expect(createWatcher).toHaveBeenCalledTimes(2);
    expect(createWatcher).toHaveBeenCalledWith('/project', state);
    expect(createWatcher).toHaveBeenCalledWith('/global', state);
    expect(state.watchers.size).toBe(2);
  });

  it('deduplicates directories', () => {
    const state = makeState();
    const layers = [
      makeLayer('project', {
        path: '/project/myapp.config.json',
        exists: true,
        extendsPaths: ['/project/base.json'],
      }),
      makeLayer('global', {
        path: '/project/other.config.json',
        exists: true,
      }),
    ];

    setupWatchers(state, layers);

    expect(createWatcher).toHaveBeenCalledTimes(2);
    expect(createWatcher).toHaveBeenCalledWith('/project', state);
    expect(createWatcher).toHaveBeenCalledWith('/global', state);
    expect(state.watchers.size).toBe(2);
  });

  it('handles empty layers array', () => {
    const state = makeState();

    setupWatchers(state, []);

    expect(createWatcher).toHaveBeenCalledTimes(2);
    expect(createWatcher).toHaveBeenCalledWith('/project', state);
    expect(createWatcher).toHaveBeenCalledWith('/global', state);
    expect(state.watchers.size).toBe(2);
  });

  it('creates watchers for extendsPaths even when layer path is undefined', () => {
    const state = makeState();
    const layers = [
      makeLayer('defaults', {
        path: undefined,
        exists: true,
        extendsPaths: ['/shared/base.json'],
      }),
    ];

    setupWatchers(state, layers);

    expect(createWatcher).toHaveBeenCalledTimes(3);
    expect(createWatcher).toHaveBeenCalledWith('/shared', state);
    expect(state.watchers.has('/shared')).toBe(true);
  });

  it('creates watchers for hook watchPaths directories', () => {
    const state = makeState({
      options: {
        name: 'myapp',
        cwd: '/project',
        globalDir: '/global',
        formatPlugins: [jsonPlugin],
        hooks: [
          {
            name: 'env',
            lifecycle: 'before:defaults',
            load: () => ({}),
            watchPaths: ['/custom/env.json'],
          },
        ],
      } as never,
    });
    const layers: ResolvedLayer[] = [];

    setupWatchers(state, layers);

    expect(createWatcher).toHaveBeenCalledWith('/custom', state);
    expect(state.watchers.has('/custom')).toBe(true);
  });

  it('ignores hooks without watchPaths when collecting directories', () => {
    const state = makeState({
      options: {
        name: 'myapp',
        cwd: '/project',
        globalDir: '/global',
        formatPlugins: [jsonPlugin],
        hooks: [
          {
            name: 'env',
            lifecycle: 'before:defaults',
            load: () => ({}),
          },
        ],
      } as never,
    });
    const layers: ResolvedLayer[] = [];

    setupWatchers(state, layers);

    expect(createWatcher).toHaveBeenCalledTimes(2);
    expect(createWatcher).toHaveBeenCalledWith('/project', state);
    expect(createWatcher).toHaveBeenCalledWith('/global', state);
    expect(state.watchers.size).toBe(2);
  });

  it('creates watchers for cwd and globalDir even when no layer has a path', () => {
    const state = makeState({
      projectPath: undefined,
    });
    const layers = [
      makeLayer('defaults', { path: undefined, exists: true }),
      makeLayer('global', { path: undefined, exists: false }),
      makeLayer('project', { path: undefined, exists: false }),
      makeLayer('overrides', { path: undefined, exists: true }),
    ];

    setupWatchers(state, layers);

    expect(createWatcher).toHaveBeenCalledWith('/project', state);
    expect(createWatcher).toHaveBeenCalledWith('/global', state);
    expect(state.watchers.has('/project')).toBe(true);
    expect(state.watchers.has('/global')).toBe(true);
  });
});

describe('updateWatchers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates watchers for new directories not in state.watchers', () => {
    const state = makeState({ watchers: new Set(['/old']) });
    const layers = [
      makeLayer('project', {
        path: '/project/myapp.config.json',
        exists: true,
      }),
    ];

    updateWatchers(state, layers);

    expect(createWatcher).toHaveBeenCalledTimes(2);
    expect(createWatcher).toHaveBeenCalledWith('/project', state);
    expect(createWatcher).toHaveBeenCalledWith('/global', state);
    expect(state.watchers.has('/project')).toBe(true);
  });

  it('skips directories already in state.watchers', () => {
    const state = makeState({ watchers: new Set(['/project', '/global']) });
    const layers = [
      makeLayer('project', {
        path: '/project/myapp.config.json',
        exists: true,
      }),
    ];

    updateWatchers(state, layers);

    expect(createWatcher).not.toHaveBeenCalled();
  });

  it('releases watchers for directories no longer in layers', () => {
    const state = makeState({
      watchers: new Set(['/old', '/project', '/global']),
    });
    const layers = [
      makeLayer('project', {
        path: '/project/myapp.config.json',
        exists: true,
      }),
    ];

    updateWatchers(state, layers);

    expect(releaseWatcher).toHaveBeenCalledTimes(1);
    expect(releaseWatcher).toHaveBeenCalledWith('/old', state);
    expect(state.watchers.has('/old')).toBe(false);
    expect(state.watchers.has('/project')).toBe(true);
  });

  it('handles no changes — same directories', () => {
    const state = makeState({ watchers: new Set(['/project', '/global']) });
    const layers = [
      makeLayer('project', {
        path: '/project/myapp.config.json',
        exists: true,
      }),
    ];

    updateWatchers(state, layers);

    expect(createWatcher).not.toHaveBeenCalled();
    expect(releaseWatcher).not.toHaveBeenCalled();
    expect(state.watchers.size).toBe(2);
  });

  it('handles both additions and removals', () => {
    const state = makeState({ watchers: new Set(['/old', '/shared']) });
    const layers = [
      makeLayer('project', {
        path: '/project/myapp.config.json',
        exists: true,
        extendsPaths: ['/shared/base.json'],
      }),
    ];

    updateWatchers(state, layers);

    expect(createWatcher).toHaveBeenCalledTimes(2);
    expect(createWatcher).toHaveBeenCalledWith('/project', state);
    expect(createWatcher).toHaveBeenCalledWith('/global', state);
    expect(releaseWatcher).toHaveBeenCalledTimes(1);
    expect(releaseWatcher).toHaveBeenCalledWith('/old', state);
    expect(state.watchers.has('/project')).toBe(true);
    expect(state.watchers.has('/shared')).toBe(true);
    expect(state.watchers.has('/old')).toBe(false);
  });

  it('handles empty layers — releases all existing watchers', () => {
    const state = makeState({ watchers: new Set(['/dir1', '/dir2']) });

    updateWatchers(state, []);

    expect(createWatcher).toHaveBeenCalledTimes(2);
    expect(createWatcher).toHaveBeenCalledWith('/project', state);
    expect(createWatcher).toHaveBeenCalledWith('/global', state);
    expect(releaseWatcher).toHaveBeenCalledTimes(2);
    expect(releaseWatcher).toHaveBeenCalledWith('/dir1', state);
    expect(releaseWatcher).toHaveBeenCalledWith('/dir2', state);
    expect(state.watchers.size).toBe(2);
  });

  it('handles empty state.watchers with new layers', () => {
    const state = makeState({ watchers: new Set() });
    const layers = [
      makeLayer('project', {
        path: '/project/myapp.config.json',
        exists: true,
      }),
    ];

    updateWatchers(state, layers);

    expect(createWatcher).toHaveBeenCalledTimes(2);
    expect(releaseWatcher).not.toHaveBeenCalled();
    expect(state.watchers.size).toBe(2);
  });
});
