import { createMockLayer, createMockStoreState } from '@oclio/test-helpers';

import { MorselError } from '@/errors/error';
import { buildLayers } from '@/load/build-layers';
import { processConfig } from '@/load/process-config';
import { resolveGlobalPath, resolveProjectPath } from '@/paths/resolve-paths';
import { jsonPlugin } from '@/plugins/json-plugin';
import { resolveOptions } from '@/store/boot/assert-name';
import { noop } from '@/store/boot/assert-name';
import { createReactiveStore } from '@/store/boot/create-reactive-store';
import { toMorselLayer } from '@/store/layer';
import { createRemerge } from '@/store/reactive/remerge-runner';
import {
  collectWatchedFiles,
  setupWatchers,
} from '@/store/reactive/watcher-setup';
import { createReactiveMorselStore } from '@/store/store';
import { createStoreState } from '@/store/store-state';
import { releaseWatcher } from '@/watch/watcher-registry';

vi.mock('@/load/build-layers', () => ({
  buildLayers: vi.fn(),
}));
vi.mock('@/load/process-config', () => ({
  processConfig: vi.fn(),
}));
vi.mock('@/paths/resolve-paths', () => ({
  resolveGlobalPath: vi.fn(),
  resolveProjectPath: vi.fn(),
}));
vi.mock('@/store/boot/assert-name', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/store/boot/assert-name')>();
  return {
    ...actual,
    resolveOptions: vi.fn(),
  };
});
vi.mock('@/store/layer', () => ({
  toMorselLayer: vi.fn(),
}));
vi.mock('@/store/reactive/remerge-runner', () => ({
  createRemerge: vi.fn(),
}));
vi.mock('@/store/store', () => ({
  createReactiveMorselStore: vi.fn(),
}));
vi.mock('@/store/store-state', () => ({
  createStoreState: vi.fn(),
}));
vi.mock('@/store/reactive/watcher-setup', () => ({
  collectWatchedFiles: vi.fn(),
  setupWatchers: vi.fn(),
}));
vi.mock('@/watch/watcher-registry', () => ({
  releaseWatcher: vi.fn(),
}));

import type { ResolvedLayer } from '@/load/resolve-layer';
import type { StoreState } from '@/store/store-state';
import type { MorselReactiveStore } from '@/store/types';

function makeResolvedLayer(
  overrides: Partial<ResolvedLayer> = {},
): ResolvedLayer {
  return createMockLayer({
    source: 'defaults',
    path: undefined,
    ...overrides,
  }) as ResolvedLayer;
}

function makeState(overrides: Partial<StoreState> = {}): StoreState {
  return createMockStoreState({
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
    },
    ...overrides,
  }) as StoreState;
}

describe('createReactiveStore', () => {
  let mockState: StoreState;
  let mockStore: MorselReactiveStore<Record<string, unknown>>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(setupWatchers).mockImplementation(() => {});
    vi.mocked(createRemerge).mockReturnValue(vi.fn());

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

    vi.mocked(processConfig).mockReturnValue({
      config: { frozen: true },
      merged: { frozen: true },
      validated: { frozen: true },
    } as never);
    vi.mocked(toMorselLayer).mockImplementation((layer) => ({
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
      off: vi.fn(),
      triggerRemerge: vi.fn(),
      stop: vi.fn(),
    } as never;
    vi.mocked(createReactiveMorselStore).mockReturnValue(mockStore);
  });

  describe('boot — initial load', () => {
    it('calls resolveOptions with provided options', async () => {
      const options = { name: 'myapp' };
      await createReactiveStore(options);

      expect(resolveOptions).toHaveBeenCalledWith(options);
    });

    it('resolves global path from globalDir and name', async () => {
      await createReactiveStore({ name: 'myapp' });

      expect(resolveGlobalPath).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'myapp' }),
        expect.any(Array),
      );
    });

    it('resolves project path via resolveProjectPath', async () => {
      await createReactiveStore({ name: 'myapp' });

      expect(resolveProjectPath).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'myapp' }),
        expect.any(Array),
      );
    });

    it('builds layers via buildLayers with resolved options and paths', async () => {
      await createReactiveStore({ name: 'myapp' });

      expect(buildLayers).toHaveBeenCalledTimes(1);
      expect(buildLayers).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'myapp' }),
        '/global/myapp.config.json',
        '/project/myapp.config.json',
        expect.any(Function),
      );
    });

    it('processes config via processConfig with layers and options', async () => {
      await createReactiveStore({ name: 'myapp' });

      expect(processConfig).toHaveBeenCalledWith(
        expect.any(Array),
        'replace',
        expect.any(Array),
        'frozen',
      );
    });

    it('maps layers through toMorselLayer', async () => {
      await createReactiveStore({ name: 'myapp' });

      expect(toMorselLayer).toHaveBeenCalledTimes(4);
    });

    it('creates store state with config, layers, and project path', async () => {
      await createReactiveStore({ name: 'myapp' });

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
      await createReactiveStore({ name: 'myapp' });

      expect(collectWatchedFiles).toHaveBeenCalledWith(
        mockState,
        expect.any(Array),
      );
    });

    it('sets up watchers with state and layers', async () => {
      await createReactiveStore({ name: 'myapp' });

      expect(setupWatchers).toHaveBeenCalledWith(mockState, expect.any(Array));
    });

    it('returns morsel store from createReactiveMorselStore', async () => {
      const result = await createReactiveStore({ name: 'myapp' });

      expect(createReactiveMorselStore).toHaveBeenCalledWith(
        mockState,
        'frozen',
        expect.any(Function),
      );
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

      await expect(createReactiveStore({ name: 'myapp' })).rejects.toThrow(
        'watcher setup failed',
      );

      expect(releaseWatcher).toHaveBeenCalledTimes(2);
      expect(releaseWatcher).toHaveBeenCalledWith('/dir1', mockState);
      expect(releaseWatcher).toHaveBeenCalledWith('/dir2', mockState);
      expect(mockState.watchers.size).toBe(0);
    });
  });

  describe('hook init', () => {
    it('calls init on hooks with init defined after store creation', async () => {
      const init = vi.fn();
      const hook = {
        name: 'test-hook',
        lifecycle: 'before:defaults',
        load: () => ({}),
        init,
      };
      vi.mocked(resolveOptions).mockReturnValue({
        name: 'myapp',
        cwd: '/project',
        defaults: {},
        overrides: {},
        globalDir: '/global',
        arrayMerge: 'replace',
        envName: 'test',
        onDebug: noop,
        configMutability: 'frozen',
        verbose: false,
        formatPlugins: [jsonPlugin],
        validationPlugins: [],
        hooks: [hook],
      } as never);

      await createReactiveStore({ name: 'myapp' });

      expect(init).toHaveBeenCalledTimes(1);
      expect(init).toHaveBeenCalledWith(
        expect.objectContaining({
          cwd: '/project',
          envName: 'test',
          triggerRemerge: expect.any(Function),
        }),
      );
    });

    it('skips init when not defined on hook', async () => {
      const hook = {
        name: 'no-init-hook',
        lifecycle: 'before:defaults',
        load: () => ({}),
      };
      vi.mocked(resolveOptions).mockReturnValue({
        name: 'myapp',
        cwd: '/project',
        defaults: {},
        overrides: {},
        globalDir: '/global',
        arrayMerge: 'replace',
        envName: 'test',
        onDebug: noop,
        configMutability: 'frozen',
        verbose: false,
        formatPlugins: [jsonPlugin],
        validationPlugins: [],
        hooks: [hook],
      } as never);

      await expect(
        createReactiveStore({ name: 'myapp' }),
      ).resolves.toBeDefined();
    });

    it('throws MorselError with EHOOK when init throws', async () => {
      const hook = {
        name: 'failing-hook',
        lifecycle: 'before:defaults',
        load: () => ({}),
        init: () => {
          throw new Error('connection refused');
        },
      };
      vi.mocked(resolveOptions).mockReturnValue({
        name: 'myapp',
        cwd: '/project',
        defaults: {},
        overrides: {},
        globalDir: '/global',
        arrayMerge: 'replace',
        envName: 'test',
        onDebug: noop,
        configMutability: 'frozen',
        verbose: false,
        formatPlugins: [jsonPlugin],
        validationPlugins: [],
        hooks: [hook],
      } as never);
      mockState.watchers = new Set(['/dir1', '/dir2']);

      await expect(createReactiveStore({ name: 'myapp' })).rejects.toThrow(
        'hook "failing-hook" failed in init: connection refused',
      );

      expect(releaseWatcher).toHaveBeenCalledTimes(2);
      expect(releaseWatcher).toHaveBeenCalledWith('/dir1', mockState);
      expect(releaseWatcher).toHaveBeenCalledWith('/dir2', mockState);
      expect(mockState.watchers.size).toBe(0);

      try {
        await createReactiveStore({ name: 'myapp' });
      } catch (error) {
        expect((error as MorselError).code).toBe('EHOOK');
      }
    });
  });

  describe('triggerRemerge', () => {
    it('passes a triggerRemerge function to buildLayers that calls remerge when state is ready', async () => {
      const mockRemerge = vi.fn();
      vi.mocked(createRemerge).mockReturnValue(mockRemerge);

      await createReactiveStore({ name: 'myapp' });

      const triggerRemerge = vi.mocked(buildLayers).mock
        .calls[0]![3] as () => void;
      triggerRemerge();

      expect(mockRemerge).toHaveBeenCalledTimes(1);
      expect(mockRemerge).toHaveBeenCalledWith(mockState);
    });

    it('triggerRemerge is a noop before state is created', async () => {
      const mockRemerge = vi.fn();
      vi.mocked(createRemerge).mockReturnValue(mockRemerge);

      let capturedTrigger: (() => void) | undefined;
      vi.mocked(buildLayers).mockImplementation(
        async (_options, _g, _p, trigger) => {
          capturedTrigger = trigger;
          // Call trigger before state is created (stateRef.current is still undefined)
          trigger!();
          return [makeResolvedLayer({ source: 'defaults', config: {} })];
        },
      );

      await createReactiveStore({ name: 'myapp' });

      expect(mockRemerge).not.toHaveBeenCalled();
      // After boot, trigger should work
      capturedTrigger!();
      expect(mockRemerge).toHaveBeenCalledTimes(1);
    });

    it('passes triggerRemerge to init context', async () => {
      const mockRemerge = vi.fn();
      vi.mocked(createRemerge).mockReturnValue(mockRemerge);
      const init = vi.fn();
      const hook = {
        name: 'test-hook',
        lifecycle: 'before:defaults',
        load: () => ({}),
        init,
      };
      vi.mocked(resolveOptions).mockReturnValue({
        name: 'myapp',
        cwd: '/project',
        defaults: {},
        overrides: {},
        globalDir: '/global',
        arrayMerge: 'replace',
        envName: 'test',
        onDebug: noop,
        configMutability: 'frozen',
        verbose: false,
        formatPlugins: [jsonPlugin],
        validationPlugins: [],
        hooks: [hook],
      } as never);

      await createReactiveStore({ name: 'myapp' });

      const initContext = init.mock.calls[0]![0];
      initContext.triggerRemerge();
      expect(mockRemerge).toHaveBeenCalledTimes(1);
    });
  });

  describe('signal — AbortSignal support', () => {
    it('calls store.stop() when signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      await createReactiveStore({ name: 'myapp', signal: controller.signal });

      expect(mockStore.stop).toHaveBeenCalledTimes(1);
    });

    it('calls store.stop() when signal aborts after boot', async () => {
      const controller = new AbortController();

      await createReactiveStore({ name: 'myapp', signal: controller.signal });

      expect(mockStore.stop).not.toHaveBeenCalled();

      controller.abort();

      expect(mockStore.stop).toHaveBeenCalledTimes(1);
    });

    it('does not call store.stop() when no signal is provided', async () => {
      await createReactiveStore({ name: 'myapp' });

      expect(mockStore.stop).not.toHaveBeenCalled();
    });
  });
});
