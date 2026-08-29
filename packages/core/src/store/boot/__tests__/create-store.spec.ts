import { createMockLayer, createMockStoreState } from '@oclio/test-helpers';

import { jsonPlugin } from '@/plugins/json-plugin';
import { noop, resolveOptions } from '@/store/boot/assert-name';
import { createStore } from '@/store/boot/create-store';
import { loadPipeline } from '@/store/boot/load-config';
import { createRemerge } from '@/store/reactive/remerge-runner';
import {
  collectWatchedFiles,
  setupWatchers,
} from '@/store/reactive/watcher-setup';
import {
  createReactiveMorselStore,
  createStaticMorselStore,
} from '@/store/store';
import { createStoreState } from '@/store/store-state';
import type { MorselStore } from '@/store/types';

vi.mock('@/store/boot/assert-name', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/store/boot/assert-name')>();
  return {
    ...actual,
    resolveOptions: vi.fn(),
  };
});
vi.mock('@/store/boot/load-config', () => ({
  loadPipeline: vi.fn(),
}));
vi.mock('@/store/store', () => ({
  createStaticMorselStore: vi.fn(),
  createReactiveMorselStore: vi.fn(),
}));
vi.mock('@/store/store-state', () => ({
  createStoreState: vi.fn(),
}));
vi.mock('@/store/reactive/watcher-setup', () => ({
  collectWatchedFiles: vi.fn(),
  setupWatchers: vi.fn(),
}));
vi.mock('@/store/reactive/remerge-runner', () => ({
  createRemerge: vi.fn(),
}));

import type { ResolvedLayer } from '@/load/resolve-layer';
import type { StoreState } from '@/store/store-state';

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

describe('createStore', () => {
  let mockState: StoreState;
  let mockStore: MorselStore<Record<string, unknown>>;

  beforeEach(() => {
    vi.clearAllMocks();

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

    vi.mocked(loadPipeline).mockResolvedValue({
      config: { frozen: true },
      layers,
      morselLayers: layers.map((layer) => ({
        source: layer.source,
        path: layer.path,
        config: layer.config,
        exists: layer.exists,
        extendsPaths: layer.extendsPaths,
      })),
      projectPath: '/project/myapp.config.json',
    });

    mockState = makeState();
    vi.mocked(createStoreState).mockReturnValue(mockState);

    mockStore = {
      config: {},
      layers: [],
      stop: vi.fn(),
    } as never;
    vi.mocked(createStaticMorselStore).mockReturnValue(mockStore);
  });

  describe('boot — initial load', () => {
    it('calls resolveOptions with provided options', async () => {
      const options = { name: 'myapp' };
      await createStore(options);

      expect(resolveOptions).toHaveBeenCalledWith(options);
    });

    it('calls loadPipeline with resolved options', async () => {
      await createStore({ name: 'myapp' });

      expect(loadPipeline).toHaveBeenCalledTimes(1);
      expect(loadPipeline).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'myapp' }),
      );
    });

    it('does not pass a triggerRemerge to loadPipeline', async () => {
      await createStore({ name: 'myapp' });

      expect(loadPipeline).toHaveBeenCalledWith(expect.any(Object));
      expect(vi.mocked(loadPipeline).mock.calls[0]!.length).toBe(1);
    });

    it('creates store state with config, layers, project path, and debounce 0', async () => {
      await createStore({ name: 'myapp' });

      expect(createStoreState).toHaveBeenCalledWith(
        { frozen: true },
        expect.any(Array),
        '/project/myapp.config.json',
        expect.objectContaining({ name: 'myapp' }),
        0,
        expect.any(Function),
      );
    });

    it('returns morsel store from createStaticMorselStore', async () => {
      const result = await createStore({ name: 'myapp' });

      expect(createStaticMorselStore).toHaveBeenCalledWith(mockState, 'frozen');
      expect(result).toBe(mockStore);
    });

    it('passes configMutability to createStaticMorselStore', async () => {
      vi.mocked(resolveOptions).mockReturnValue({
        name: 'myapp',
        cwd: '/project',
        defaults: {},
        overrides: {},
        globalDir: '/global',
        arrayMerge: 'replace',
        envName: 'test',
        onDebug: noop,
        configMutability: 'mutable',
        verbose: false,
        formatPlugins: [jsonPlugin],
        validationPlugins: [],
        hooks: [],
      } as never);

      await createStore({ name: 'myapp' });

      expect(createStaticMorselStore).toHaveBeenCalledWith(
        mockState,
        'mutable',
      );
    });
  });

  describe('static behavior — no reactive features', () => {
    it('does not call collectWatchedFiles', async () => {
      await createStore({ name: 'myapp' });

      expect(collectWatchedFiles).not.toHaveBeenCalled();
    });

    it('does not call setupWatchers', async () => {
      await createStore({ name: 'myapp' });

      expect(setupWatchers).not.toHaveBeenCalled();
    });

    it('does not call createRemerge', async () => {
      await createStore({ name: 'myapp' });

      expect(createRemerge).not.toHaveBeenCalled();
    });

    it('does not call createReactiveMorselStore', async () => {
      await createStore({ name: 'myapp' });

      expect(createReactiveMorselStore).not.toHaveBeenCalled();
    });
  });

  describe('stop function', () => {
    it('passes a noop stop function to createStoreState', async () => {
      await createStore({ name: 'myapp' });

      const stopFunction = vi.mocked(createStoreState).mock
        .calls[0]![5] as () => Promise<void>;
      await expect(stopFunction()).resolves.toBeUndefined();
    });
  });

  describe('error propagation', () => {
    it('propagates errors from loadPipeline', async () => {
      vi.mocked(loadPipeline).mockRejectedValue(new Error('load failed'));

      await expect(createStore({ name: 'myapp' })).rejects.toThrow(
        'load failed',
      );
    });

    it('propagates errors from resolveOptions', async () => {
      vi.mocked(resolveOptions).mockImplementation(() => {
        throw new Error('invalid options');
      });

      await expect(createStore({ name: '' })).rejects.toThrow(
        'invalid options',
      );
    });
  });
});
