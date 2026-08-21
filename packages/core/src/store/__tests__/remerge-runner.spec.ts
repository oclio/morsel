import { MorselError } from '@/errors/morsel-error';
import { buildLayers } from '@/load/build-layers';
import { applyMutability, mergeLayers } from '@/load/merge-layers';
import type { ResolvedLayer } from '@/load/resolve-layer';
import { resolveGlobalPath, resolveProjectPath } from '@/paths/resolve-paths';
import { jsonPlugin } from '@/plugins/json-plugin';
import { noop } from '@/store/assert-name';
import { emitChanges } from '@/store/emit-changes';
import { toMorselLayer } from '@/store/morsel-layer';
import { createRemerge } from '@/store/remerge-runner';
import type { StoreState } from '@/store/store-state';
import { deepCloneConfig } from '@/store/store-state';
import { updateWatchedFiles, updateWatchers } from '@/store/watcher-setup';

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
vi.mock('@/store/emit-changes', () => ({
  emitChanges: vi.fn(),
}));
vi.mock('@/store/morsel-layer', () => ({
  toMorselLayer: vi.fn(),
}));
vi.mock('@/store/store-state', () => ({
  deepCloneConfig: vi.fn(),
}));
vi.mock('@/store/watcher-setup', () => ({
  updateWatchedFiles: vi.fn(),
  updateWatchers: vi.fn(),
}));

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

describe('createRemerge', () => {
  let remerge: (store: StoreState) => Promise<void>;

  beforeEach(() => {
    vi.clearAllMocks();

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
    vi.mocked(toMorselLayer).mockImplementation((layer) => ({
      source: layer.source,
      path: layer.path,
      config: layer.config,
      exists: layer.exists,
      extendsPaths: layer.extendsPaths,
    }));
    vi.mocked(deepCloneConfig).mockReturnValue({ cloned: true });

    remerge = createRemerge();
  });

  it('sets pendingRemerge and returns early if remergeInProgress is true', async () => {
    const state = makeState({ remergeInProgress: true });

    await remerge(state);

    expect(buildLayers).not.toHaveBeenCalled();
    expect(state.pendingRemerge).toBe(true);
  });

  it('returns early if store is stopped', async () => {
    const state = makeState({ stopped: true });

    await remerge(state);

    expect(buildLayers).not.toHaveBeenCalled();
  });

  it('sets remergeInProgress to true during execution', async () => {
    const state = makeState();
    let capturedInProgress: boolean | undefined;
    vi.mocked(mergeLayers).mockImplementationOnce(() => {
      capturedInProgress = state.remergeInProgress;
      return { merged: true };
    });

    await remerge(state);

    expect(capturedInProgress).toBe(true);
    expect(state.remergeInProgress).toBe(false);
  });

  it('creates remergeDone promise during execution', async () => {
    const state = makeState();
    let capturedRemergeDone: Promise<void> | undefined;
    vi.mocked(mergeLayers).mockImplementationOnce(() => {
      capturedRemergeDone = state.remergeDone;
      return { merged: true };
    });

    await remerge(state);

    expect(capturedRemergeDone).toBeInstanceOf(Promise);
    expect(state.remergeDone).toBeUndefined();
  });

  it('re-resolves layers via buildLayers during remerge', async () => {
    const state = makeState();

    await remerge(state);

    expect(buildLayers).toHaveBeenCalledTimes(1);
    expect(buildLayers).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'myapp' }),
      '/global/myapp.config.json',
      '/project/myapp.config.json',
    );
  });

  it('resolves remergeDone promise in finally', async () => {
    const state = makeState();
    let capturedPromise: Promise<void> | undefined;
    vi.mocked(mergeLayers).mockImplementationOnce(() => {
      capturedPromise = state.remergeDone;
      return { merged: true };
    });

    await remerge(state);

    expect(capturedPromise).toBeInstanceOf(Promise);
    await expect(capturedPromise).resolves.toBeUndefined();
  });

  it('merges new layers', async () => {
    const state = makeState();

    await remerge(state);

    expect(mergeLayers).toHaveBeenCalledTimes(1);
  });

  it('clones new config into lastConfig in mutable mode', async () => {
    const state = makeState({
      options: {
        ...makeState().options,
        configMutability: 'mutable',
      } as never,
    });

    await remerge(state);

    expect(deepCloneConfig).toHaveBeenCalled();
    expect(state.lastConfig).toEqual({ cloned: true });
  });

  it('stores validated config directly in lastConfig in frozen mode', async () => {
    const state = makeState();

    await remerge(state);

    expect(deepCloneConfig).not.toHaveBeenCalled();
    expect(state.lastConfig).toEqual({ merged: true });
  });

  it('applies mutability to new config', async () => {
    const state = makeState();

    await remerge(state);

    expect(applyMutability).toHaveBeenCalledTimes(1);
  });

  it('updates layers through toMorselLayer', async () => {
    const state = makeState();

    await remerge(state);

    expect(toMorselLayer).toHaveBeenCalledTimes(4);
  });

  it('calls updateWatchedFiles', async () => {
    const state = makeState();

    await remerge(state);

    expect(updateWatchedFiles).toHaveBeenCalledWith(state, expect.any(Array));
  });

  it('calls updateWatchers', async () => {
    const state = makeState();

    await remerge(state);

    expect(updateWatchers).toHaveBeenCalledWith(state, expect.any(Array));
  });

  it('emits changes to listeners', async () => {
    const state = makeState({ lastConfig: { old: true } });

    await remerge(state);

    expect(emitChanges).toHaveBeenCalledWith(
      { old: true },
      { merged: true },
      state.listeners,
    );
  });

  it('cleans up remerge state in finally', async () => {
    const state = makeState();

    await remerge(state);

    expect(state.remergeInProgress).toBe(false);
    expect(state.remergeDone).toBeUndefined();
  });

  it('relaunches remerge when pendingRemerge is true', async () => {
    const state = makeState({ pendingRemerge: true });

    await remerge(state);
    if (state.remergeDone !== undefined) {
      await state.remergeDone;
    }

    expect(state.pendingRemerge).toBe(false);
    expect(state.remergeInProgress).toBe(false);
  });

  it('calls onDebug with error message and context (not stderr)', async () => {
    const onDebug = vi.fn();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const state = makeState({
      options: {
        ...makeState().options,
        onDebug,
      } as never,
    });
    vi.mocked(mergeLayers).mockImplementationOnce(() => {
      throw new Error('merge failed');
    });

    await remerge(state);

    expect(onDebug).toHaveBeenCalledWith(
      'morsel: re-merge failed — keeping last valid config',
      { error: 'Error: merge failed' },
    );
    const context = onDebug.mock.calls[0]![1] as Record<string, unknown>;
    expect('code' in context).toBe(false);
    expect('path' in context).toBe(false);
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('preserves MorselError code and path in onDebug context', async () => {
    const onDebug = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const state = makeState({
      options: {
        ...makeState().options,
        onDebug,
      } as never,
    });
    vi.mocked(mergeLayers).mockImplementationOnce(() => {
      throw new MorselError(
        '/path/to/file.json',
        'EIO',
        new Error('read failed'),
      );
    });

    await remerge(state);

    expect(onDebug).toHaveBeenCalledWith(
      'morsel: re-merge failed — keeping last valid config',
      {
        error: 'MorselError: morsel: EIO — read failed (/path/to/file.json)',
        code: 'EIO',
        path: '/path/to/file.json',
      },
    );
    vi.restoreAllMocks();
  });

  it('logs errors to console.error when onDebug is default noop', async () => {
    const state = makeState();
    vi.mocked(mergeLayers).mockImplementationOnce(() => {
      throw new Error('merge failed');
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await remerge(state);

    expect(consoleSpy).toHaveBeenCalledWith(
      'morsel: re-merge failed — keeping last valid config — Error: merge failed',
    );
    consoleSpy.mockRestore();
  });

  it('still cleans up remerge state on error', async () => {
    const state = makeState();
    vi.mocked(mergeLayers).mockImplementationOnce(() => {
      throw new Error('merge failed');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await remerge(state);

    expect(state.remergeInProgress).toBe(false);
    expect(state.remergeDone).toBeUndefined();
  });

  it('works without Promise.withResolvers (Node 18 compatibility)', async () => {
    const state = makeState();
    const withResolvers = Promise.withResolvers;
    // @ts-expect-error -- simulate Node 18 where withResolvers is undefined
    delete Promise.withResolvers;

    try {
      await remerge(state);

      expect(buildLayers).toHaveBeenCalledTimes(1);
      expect(state.remergeInProgress).toBe(false);
    } finally {
      Promise.withResolvers = withResolvers;
    }
  });

  it('rolls back watcher state but keeps new config when updateWatchers throws', async () => {
    const originalLastConfig = { old: true };
    const originalConfig = { old: true } as never;
    const originalWatchedFiles = new Map([['/old', new Set(['file.json'])]]);
    const originalWatchers = new Set(['/old']);
    const state = makeState({
      lastConfig: originalLastConfig,
      _config: originalConfig,
      _layers: [{ source: 'defaults' }] as never,
      watchedFiles: originalWatchedFiles,
      watchers: originalWatchers,
    });
    vi.mocked(updateWatchedFiles).mockImplementationOnce((s) => {
      s.watchedFiles.set('/new', new Set(['new.json']));
    });
    vi.mocked(updateWatchers).mockImplementationOnce((s) => {
      s.watchers.add('/new');
      throw new Error('watcher setup failed');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await remerge(state);

    expect(state.lastConfig).not.toBe(originalLastConfig);
    expect(state._config).not.toBe(originalConfig);
    expect(state.watchedFiles.has('/new')).toBe(false);
    expect(state.watchedFiles.has('/old')).toBe(true);
    expect(state.watchers.has('/new')).toBe(false);
    expect(state.watchers.has('/old')).toBe(true);
  });

  it.each([
    {
      name: 'project',
      oldLayers: [
        { source: 'defaults', exists: true },
        { source: 'project', exists: true },
      ],
      enoentLayers: [
        makeResolvedLayer({ source: 'defaults', config: { port: 4000 } }),
        makeResolvedLayer({
          source: 'global',
          path: '/global/myapp.config.json',
          config: {},
        }),
        makeResolvedLayer({
          source: 'project',
          path: '/project/myapp.config.json',
          config: {},
          exists: false,
        }),
        makeResolvedLayer({ source: 'overrides', config: {} }),
      ],
    },
    {
      name: 'global',
      oldLayers: [
        { source: 'global', exists: true },
        { source: 'project', exists: true },
      ],
      enoentLayers: [
        makeResolvedLayer({ source: 'defaults', config: {} }),
        makeResolvedLayer({
          source: 'global',
          path: '/global/myapp.config.json',
          config: {},
          exists: false,
        }),
        makeResolvedLayer({
          source: 'project',
          path: '/project/myapp.config.json',
          config: { port: 3000 },
        }),
        makeResolvedLayer({ source: 'overrides', config: {} }),
      ],
    },
  ])(
    'keeps last config when $name layer disappears (ENOENT)',
    async ({ oldLayers, enoentLayers }) => {
      const state = makeState({
        lastConfig: { port: 3000 },
        _layers: oldLayers as never,
      });

      vi.mocked(buildLayers).mockResolvedValueOnce(enoentLayers);

      await remerge(state);

      expect(mergeLayers).not.toHaveBeenCalled();
      expect(state.lastConfig).toEqual({ port: 3000 });
    },
  );

  it('calls onDebug once with ENOENT context when layer disappears', async () => {
    const onDebug = vi.fn();
    const state = makeState({
      options: {
        ...makeState().options,
        onDebug,
      } as never,
      lastConfig: { port: 3000 },
      _layers: [{ source: 'project', exists: true } as never],
    });

    const enoentLayers: ResolvedLayer[] = [
      makeResolvedLayer({ source: 'defaults', config: {} }),
      makeResolvedLayer({
        source: 'global',
        path: '/global/myapp.config.json',
        config: {},
      }),
      makeResolvedLayer({
        source: 'project',
        path: '/project/myapp.config.json',
        config: {},
        exists: false,
      }),
      makeResolvedLayer({ source: 'overrides', config: {} }),
    ];
    vi.mocked(buildLayers).mockResolvedValueOnce(enoentLayers);

    await remerge(state);

    expect(onDebug).toHaveBeenCalledTimes(1);
    expect(onDebug).toHaveBeenCalledWith(
      'morsel: file disappeared — keeping last valid config',
      { code: 'ENOENT', sources: ['project'] },
    );
  });

  it('suppresses duplicate onDebug calls for same disappeared source', async () => {
    const onDebug = vi.fn();
    const state = makeState({
      options: {
        ...makeState().options,
        onDebug,
      } as never,
      lastConfig: { port: 3000 },
      _layers: [{ source: 'project', exists: true } as never],
    });

    const enoentLayers: ResolvedLayer[] = [
      makeResolvedLayer({ source: 'defaults', config: {} }),
      makeResolvedLayer({
        source: 'global',
        path: '/global/myapp.config.json',
        config: {},
      }),
      makeResolvedLayer({
        source: 'project',
        path: '/project/myapp.config.json',
        config: {},
        exists: false,
      }),
      makeResolvedLayer({ source: 'overrides', config: {} }),
    ];
    vi.mocked(buildLayers).mockResolvedValue(enoentLayers);

    await remerge(state);
    await remerge(state);
    await remerge(state);

    expect(onDebug).toHaveBeenCalledTimes(1);
  });

  it('resets enoentLogged when all files reappear', async () => {
    const onDebug = vi.fn();
    const state = makeState({
      options: {
        ...makeState().options,
        onDebug,
      } as never,
      lastConfig: { port: 3000 },
      _layers: [{ source: 'project', exists: true } as never],
      enoentLogged: new Set(['project']),
    });

    // buildLayers returns default layers (all exist: true) from beforeEach
    await remerge(state);

    expect(mergeLayers).toHaveBeenCalledTimes(1);
    expect(state.enoentLogged.size).toBe(0);
  });

  it('logs to console.error when onDebug is noop and layer disappears', async () => {
    const state = makeState({
      lastConfig: { port: 3000 },
      _layers: [{ source: 'project', exists: true } as never],
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const enoentLayers: ResolvedLayer[] = [
      makeResolvedLayer({ source: 'defaults', config: {} }),
      makeResolvedLayer({
        source: 'global',
        path: '/global/myapp.config.json',
        config: {},
      }),
      makeResolvedLayer({
        source: 'project',
        path: '/project/myapp.config.json',
        config: {},
        exists: false,
      }),
      makeResolvedLayer({ source: 'overrides', config: {} }),
    ];
    vi.mocked(buildLayers).mockResolvedValueOnce(enoentLayers);

    await remerge(state);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('morsel: file disappeared'),
    );
    consoleSpy.mockRestore();
  });

  it('does not treat defaults/overrides disappearance as ENOENT', async () => {
    const state = makeState({
      lastConfig: { port: 3000 },
      _layers: [
        { source: 'defaults', exists: true } as never,
        { source: 'overrides', exists: true } as never,
      ],
    });

    // defaults and overrides are raw objects, always exists: true
    // buildLayers returns the default mock (all exists: true)
    await remerge(state);

    expect(mergeLayers).toHaveBeenCalledTimes(1);
  });

  it('does not trigger ENOENT guard for defaults/overrides with exists:false', async () => {
    const state = makeState({
      lastConfig: { port: 3000 },
      _layers: [
        { source: 'defaults', exists: true } as never,
        { source: 'overrides', exists: true } as never,
      ],
    });

    const layers: ResolvedLayer[] = [
      makeResolvedLayer({ source: 'defaults', config: {}, exists: false }),
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
      makeResolvedLayer({ source: 'overrides', config: {}, exists: false }),
    ];
    vi.mocked(buildLayers).mockResolvedValueOnce(layers);

    await remerge(state);

    expect(mergeLayers).toHaveBeenCalledTimes(1);
  });

  it('does not trigger ENOENT guard when layer never existed before', async () => {
    const state = makeState({
      lastConfig: { port: 3000 },
      _layers: [{ source: 'project', exists: false } as never],
    });

    const layers: ResolvedLayer[] = [
      makeResolvedLayer({ source: 'defaults', config: {} }),
      makeResolvedLayer({
        source: 'global',
        path: '/global/myapp.config.json',
        config: {},
      }),
      makeResolvedLayer({
        source: 'project',
        path: '/project/myapp.config.json',
        config: {},
        exists: false,
      }),
      makeResolvedLayer({ source: 'overrides', config: {} }),
    ];
    vi.mocked(buildLayers).mockResolvedValueOnce(layers);

    await remerge(state);

    expect(mergeLayers).toHaveBeenCalledTimes(1);
  });

  it('matches old layer by source, not by position in _layers', async () => {
    const state = makeState({
      lastConfig: { port: 3000 },
      _layers: [
        { source: 'defaults', exists: false } as never,
        { source: 'project', exists: true } as never,
      ],
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const layers: ResolvedLayer[] = [
      makeResolvedLayer({ source: 'defaults', config: {} }),
      makeResolvedLayer({
        source: 'global',
        path: '/global/myapp.config.json',
        config: {},
      }),
      makeResolvedLayer({
        source: 'project',
        path: '/project/myapp.config.json',
        config: {},
        exists: false,
      }),
      makeResolvedLayer({ source: 'overrides', config: {} }),
    ];
    vi.mocked(buildLayers).mockResolvedValueOnce(layers);

    await remerge(state);

    expect(mergeLayers).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
