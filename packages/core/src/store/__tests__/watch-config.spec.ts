import { buildLayers } from '@/load/build-layers';
import { applyMutability, mergeLayers } from '@/load/merge-layers';
import { resolveGlobalPath, resolveProjectPath } from '@/paths/resolve-paths';
import { jsonPlugin } from '@/plugins/json-plugin';
import { resolveOptions } from '@/store/assert-name';
import { noop } from '@/store/assert-name';
import { toMorselLayer } from '@/store/morsel-layer';
import { createMorselStore } from '@/store/morsel-store';
import { createStoreState } from '@/store/store-state';
import { watchConfig } from '@/store/watch-config';
import { collectWatchedFiles, setupWatchers } from '@/store/watcher-setup';
import { releaseWatcher } from '@/watch/watcher-registry';

vi.mock('@/load/build-layers', () => ({
  buildLayers: vi.fn(),
}));
vi.mock('@/load/merge-layers', () => ({
  applyMutability: vi.fn(),
  mergeLayers: vi.fn(),
}));
vi.mock('@/paths/resolve-paths', () => ({
  resolveGlobalPath: vi.fn(),
  resolveProjectPath: vi.fn(),
}));
vi.mock('@/store/assert-name', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/store/assert-name')>();
  return {
    ...actual,
    resolveOptions: vi.fn(),
  };
});
vi.mock('@/store/morsel-layer', () => ({
  toMorselLayer: vi.fn(),
}));
vi.mock('@/store/morsel-store', () => ({
  createMorselStore: vi.fn(),
}));
vi.mock('@/store/store-state', () => ({
  createStoreState: vi.fn(),
}));
vi.mock('@/store/watcher-setup', () => ({
  collectWatchedFiles: vi.fn(),
  setupWatchers: vi.fn(),
}));
vi.mock('@/watch/watcher-registry', () => ({
  releaseWatcher: vi.fn(),
}));

import type { ResolvedLayer } from '@/load/resolve-layer';
import type { StoreState } from '@/store/store-state';
import type { MorselStore } from '@/store/types';

function makeResolvedLayer(
  overrides: Partial<ResolvedLayer> = {},
): ResolvedLayer {
  return {
    source: 'defaults',
    path: undefined,
    config: {},
    exists: true,
    extendsPaths: [],
    ...overrides,
  };
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
    projectPath: '/project/config.json',
    options: {
      name: 'myapp',
      cwd: '/project',
      defaults: { default: true },
      overrides: { override: true },
      globalDir: '/global',
      arrayMerge: 'replace',
      envName: 'test',
      onDebug: noop,
      configMutability: 'frozen',
      verbose: false,
      formatPlugins: [jsonPlugin],
      validationPlugins: [],
      hooks: [],
    } as never,
    lastConfig: {},
    remergeInProgress: false,
    remergeDone: undefined,
    pendingRemerge: false,
    debounceTimers: new Map(),
    debounceMs: 300,
    remerge: vi.fn(),
    enoentLogged: new Set(),
    ...overrides,
  } as StoreState;
}

describe('watchConfig', () => {
  let mockState: StoreState;
  let mockStore: MorselStore<Record<string, unknown>>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(setupWatchers).mockImplementation(() => {});

    vi.mocked(resolveOptions).mockReturnValue({
      name: 'myapp',
      cwd: '/project',
      defaults: { default: true },
      overrides: { override: true },
      globalDir: '/global',
      arrayMerge: 'replace',
      envName: 'test',
      onDebug: noop,
      configMutability: 'frozen',
      verbose: false,
      formatPlugins: [jsonPlugin],
      validationPlugins: [],
      hooks: [],
    } as never);

    vi.mocked(resolveGlobalPath).mockResolvedValue('/global/myapp.config.json');
    vi.mocked(resolveProjectPath).mockResolvedValue(
      '/project/myapp.config.json',
    );

    const layers: ResolvedLayer[] = [
      makeResolvedLayer({ source: 'defaults', config: { default: true } }),
      makeResolvedLayer({
        source: 'global',
        path: '/global/myapp.config.json',
        config: {},
      }),
      makeResolvedLayer({
        source: 'project',
        path: '/project/myapp.config.json',
        config: {},
      }),
      makeResolvedLayer({ source: 'overrides', config: { override: true } }),
    ];

    vi.mocked(buildLayers).mockResolvedValue(layers);

    vi.mocked(mergeLayers).mockReturnValue({ merged: true });
    vi.mocked(applyMutability).mockReturnValue({ frozen: true });
    vi.mocked(toMorselLayer).mockImplementation((layer, configName) => ({
      configName,
      source: layer.source,
      path: layer.path,
      config: layer.config,
      exists: layer.exists,
      extendsPaths: layer.extendsPaths,
    }));

    mockState = makeState();
    vi.mocked(createStoreState).mockReturnValue(mockState);

    mockStore = {
      config: {},
      layers: [],
      on: vi.fn(),
      stop: vi.fn(),
    } as never;
    vi.mocked(createMorselStore).mockReturnValue(mockStore);
  });

  describe('boot — initial load', () => {
    it('calls resolveOptions with provided options', async () => {
      const options = { name: 'myapp' };
      await watchConfig(options);

      expect(resolveOptions).toHaveBeenCalledWith(options);
    });

    it('resolves global path from globalDir and name', async () => {
      await watchConfig({ name: 'myapp' });

      expect(resolveGlobalPath).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'myapp' }),
        expect.any(Array),
      );
    });

    it('resolves project path via resolveProjectPath', async () => {
      await watchConfig({ name: 'myapp' });

      expect(resolveProjectPath).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'myapp' }),
        expect.any(Array),
      );
    });

    it('builds layers via buildLayers with resolved options and paths', async () => {
      await watchConfig({ name: 'myapp' });

      expect(buildLayers).toHaveBeenCalledTimes(1);
      expect(buildLayers).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'myapp' }),
        '/global/myapp.config.json',
        '/project/myapp.config.json',
      );
    });

    it('merges layers with arrayMerge strategy', async () => {
      await watchConfig({ name: 'myapp' });

      expect(mergeLayers).toHaveBeenCalledWith(expect.any(Array), 'replace');
    });

    it('applies mutability to merged config', async () => {
      await watchConfig({ name: 'myapp' });

      expect(applyMutability).toHaveBeenCalledWith({ merged: true }, 'frozen');
    });

    it('maps layers through toMorselLayer', async () => {
      await watchConfig({ name: 'myapp' });

      expect(toMorselLayer).toHaveBeenCalledTimes(4);
    });

    it('creates store state with config, layers, and project path', async () => {
      await watchConfig({ name: 'myapp' });

      expect(createStoreState).toHaveBeenCalledWith(
        { frozen: true },
        expect.any(Array),
        '/project/myapp.config.json',
        expect.objectContaining({ name: 'myapp' }),
        300,
        expect.any(Function),
      );
    });

    it('collects watched files from layers', async () => {
      await watchConfig({ name: 'myapp' });

      expect(collectWatchedFiles).toHaveBeenCalledWith(
        mockState,
        expect.any(Array),
      );
    });

    it('sets up watchers with state and layers', async () => {
      await watchConfig({ name: 'myapp' });

      expect(setupWatchers).toHaveBeenCalledWith(mockState, expect.any(Array));
    });

    it('returns morsel store from createMorselStore', async () => {
      const result = await watchConfig({ name: 'myapp' });

      expect(createMorselStore).toHaveBeenCalledWith(mockState, 'frozen');
      expect(result).toBe(mockStore);
    });
  });

  describe('boot — setupWatchers error', () => {
    it('releases all watchers and rethrows on setupWatchers failure', async () => {
      const error = new Error('watcher setup failed');
      vi.mocked(setupWatchers).mockImplementation(() => {
        throw error;
      });
      mockState.watchers = new Set(['/dir1', '/dir2']);

      await expect(watchConfig({ name: 'myapp' })).rejects.toThrow(
        'watcher setup failed',
      );

      expect(releaseWatcher).toHaveBeenCalledTimes(2);
      expect(releaseWatcher).toHaveBeenCalledWith('/dir1', mockState);
      expect(releaseWatcher).toHaveBeenCalledWith('/dir2', mockState);
      expect(mockState.watchers.size).toBe(0);
    });
  });
});
