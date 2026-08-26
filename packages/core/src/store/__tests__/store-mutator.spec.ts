import { runWriteHooks } from '@/hooks/run-hooks';
import { applyValidation } from '@/load/apply-validation';
import { applyMutability, mergeLayers } from '@/load/merge-layers';
import { interpolate } from '@/merge/interpolate';
import { parsePath } from '@/paths/parse-path';
import {
  getPathValue,
  hasRemovedPathValue,
  setPathValue,
} from '@/paths/path-access';
import { toMorselLayer } from '@/store/layer';
import { emitChanges } from '@/store/reactive/emit-changes';
import { deleteKey, mutateKey, setKey, unsetKey } from '@/store/store-mutator';
import type { StoreState } from '@/store/store-state';
import { deepCloneConfig } from '@/store/store-state';
import type { MorselLayer } from '@/store/types';
import { resolveKeyOrigin } from '@/writer/resolve-origin';
import { writeConfigFile } from '@/writer/write-config';

vi.mock('@/hooks/run-hooks', () => ({
  runWriteHooks: vi.fn(),
}));
vi.mock('@/load/apply-validation', () => ({
  applyValidation: vi.fn(),
}));
vi.mock('@/load/merge-layers', () => ({
  applyMutability: vi.fn(),
  mergeLayers: vi.fn(),
}));
vi.mock('@/merge/interpolate', () => ({
  interpolate: vi.fn(),
}));
vi.mock('@/paths/parse-path', () => ({
  parsePath: vi.fn(),
}));
vi.mock('@/paths/path-access', () => ({
  getPathValue: vi.fn(),
  hasRemovedPathValue: vi.fn(),
  setPathValue: vi.fn(),
}));
vi.mock('@/store/layer', () => ({
  toMorselLayer: vi.fn(),
}));
vi.mock('@/store/reactive/emit-changes', () => ({
  emitChanges: vi.fn(),
}));
vi.mock('@/store/store-state', () => ({
  deepCloneConfig: vi.fn(),
}));
vi.mock('@/writer/resolve-origin', () => ({
  resolveKeyOrigin: vi.fn(),
}));
vi.mock('@/writer/write-config', () => ({
  writeConfigFile: vi.fn(),
}));

function createState<T extends Record<string, unknown>>(
  overrides: Partial<StoreState<T>> = {},
): StoreState<T> {
  const projectPath = overrides.projectPath ?? '/project/config.json';
  return {
    _config: { foo: 'bar' } as unknown as T,
    _proxy: undefined,
    _stoppedConfig: undefined,
    _layers: [
      {
        source: 'project',
        path: projectPath,
        config: {},
        exists: true,
        extendsPaths: [],
      },
      {
        source: 'project',
        path: '/origin/config.json',
        config: {},
        exists: true,
        extendsPaths: [],
      },
    ] as never,
    listeners: new Map(),
    wildcardListeners: new Map(),
    stopped: false,
    watchers: new Set(),
    watchedFiles: new Map(),
    projectPath,
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

describe('store-mutator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(applyValidation).mockImplementation((config) => config);
    vi.mocked(applyMutability).mockImplementation((config) => config);
    vi.mocked(mergeLayers).mockImplementation((layers) => {
      let merged = {};
      for (const layer of layers) {
        merged = { ...merged, ...layer.config };
      }
      return merged;
    });
    vi.mocked(interpolate).mockImplementation((config) => config);
    vi.mocked(toMorselLayer).mockImplementation(
      (layer) => layer as MorselLayer,
    );
    vi.mocked(deepCloneConfig).mockImplementation(
      (config) => structuredClone(config) as Record<string, unknown>,
    );
    vi.mocked(parsePath).mockImplementation((path) =>
      typeof path === 'string' ? path.split('.') : [...path],
    );
    vi.mocked(setPathValue).mockImplementation((object, segments, value) => {
      let current = object as Record<string, unknown>;
      for (let index = 0; index < segments.length - 1; index++) {
        if (current[segments[index] as string] === undefined) {
          current[segments[index] as string] = {};
        }
        current = current[segments[index] as string] as Record<string, unknown>;
      }
      current[segments.at(-1) as string] = value;
    });
    vi.mocked(hasRemovedPathValue).mockReturnValue(true);
    vi.mocked(getPathValue).mockImplementation((object, path) => {
      const segments = typeof path === 'string' ? path.split('.') : [...path];
      let current: unknown = object;
      for (const seg of segments) {
        current = (current as Record<string, unknown>)?.[seg];
      }
      return current;
    });
    vi.mocked(emitChanges).mockImplementation(() => {});
    vi.mocked(resolveKeyOrigin).mockReturnValue({
      filePath: '/project/config.json',
      layer: {
        source: 'project',
        path: '/fallback/config.json',
        config: {},
        exists: true,
        extendsPaths: [],
      } as never,
      isWritable: true,
      exists: true,
    });
    vi.mocked(writeConfigFile).mockResolvedValue(undefined);
    vi.mocked(runWriteHooks).mockResolvedValue(undefined);
  });

  describe('mutateKey', () => {
    it('throws when store is stopped', async () => {
      const state = createState({ stopped: true });

      await expect(
        mutateKey(state, 'foo', 'bar', undefined, 'mutable'),
      ).rejects.toThrow('morsel: store is stopped');
    });

    it('calls writeConfigFile with correct arguments', async () => {
      const state = createState({
        _config: { server: { port: 3000 } } as never,
        _layers: [
          {
            source: 'project',
            path: '/project/config.json',
            config: {},
            exists: true,
            extendsPaths: [],
          },
        ] as never,
      });

      await mutateKey(state, 'server.port', 8080, undefined, 'mutable');

      expect(writeConfigFile).toHaveBeenCalledWith(
        '/project/config.json',
        { path: 'server.port', value: 8080 },
        state.options.formatPlugins,
      );
    });

    it('calls runWriteHooks after successful write', async () => {
      const state = createState({
        _config: { server: { port: 3000 } } as never,
        _layers: [
          {
            source: 'project',
            path: '/project/config.json',
            config: {},
            exists: true,
            extendsPaths: [],
          },
        ] as never,
      });

      await mutateKey(state, 'server.port', 8080, undefined, 'mutable');

      expect(runWriteHooks).toHaveBeenCalledTimes(1);
      expect(runWriteHooks).toHaveBeenCalledWith(
        state.options.hooks,
        expect.objectContaining({
          filePath: '/project/config.json',
          keyPath: 'server.port',
          mutation: { path: 'server.port', value: 8080 },
        }),
        state.options.onDebug,
      );
    });

    it('does not call runWriteHooks on write failure', async () => {
      vi.mocked(writeConfigFile).mockRejectedValue(new Error('EWRITE'));
      vi.mocked(resolveKeyOrigin).mockReturnValue({
        filePath: '/project/config.json',
        layer: {
          path: '/project/config.json',
          source: 'project',
          exists: true,
          extendsPaths: [],
          config: {},
        },
        isWritable: true,
        exists: true,
      });

      const state = createState({
        _config: { server: { port: 3000 } } as never,
      });

      await expect(
        mutateKey(state, 'server.port', 8080, undefined, 'mutable'),
      ).rejects.toThrow('EWRITE');

      expect(runWriteHooks).not.toHaveBeenCalled();
    });

    it('rolls back config on write failure', async () => {
      vi.mocked(writeConfigFile).mockRejectedValue(new Error('EWRITE'));

      const state = createState({
        _config: { server: { port: 3000 } } as never,
        _layers: [
          {
            source: 'project',
            path: '/project/config.json',
            config: {},
            exists: true,
            extendsPaths: [],
          },
        ] as never,
      });

      await expect(
        mutateKey(state, 'server.port', 8080, undefined, 'mutable'),
      ).rejects.toThrow('EWRITE');

      expect(getPathValue(state._config, 'server.port')).toBe(3000);
    });

    it('falls back to projectPath when origin has no filePath', async () => {
      vi.mocked(resolveKeyOrigin).mockReturnValue({
        filePath: undefined,
        layer: {
          source: 'project',
          path: '/origin/config.json',
          config: {},
          exists: true,
          extendsPaths: [],
        } as never,
        isWritable: false,
        exists: false,
      });

      const state = createState({
        _config: { server: { port: 3000 } } as never,
        projectPath: '/fallback/config.json',
      });

      await mutateKey(state, 'server.port', 8080, undefined, 'mutable');

      expect(writeConfigFile).toHaveBeenCalledWith(
        '/fallback/config.json',
        { path: 'server.port', value: 8080 },
        state.options.formatPlugins,
      );
    });

    it('throws when no writable file is found', async () => {
      vi.mocked(resolveKeyOrigin).mockReturnValue({
        filePath: undefined,
        layer: undefined,
        isWritable: false,
        exists: false,
      });

      const state = createState({
        _config: { server: { port: 3000 } } as never,
        projectPath: undefined,
      });

      await expect(
        mutateKey(state, 'server.port', 8080, undefined, 'mutable'),
      ).rejects.toThrow(
        'morsel: cannot write "server.port" — no writable file found',
      );
    });

    it('uses origin filePath when defined instead of projectPath', async () => {
      vi.mocked(resolveKeyOrigin).mockReturnValue({
        filePath: '/origin/config.json',
        layer: undefined,
        isWritable: true,
        exists: true,
      });

      const state = createState({
        _config: { server: { port: 3000 } } as never,
        projectPath: '/fallback/config.json',
      });

      await mutateKey(state, 'server.port', 8080, undefined, 'mutable');

      expect(writeConfigFile).toHaveBeenCalledWith(
        '/origin/config.json',
        { path: 'server.port', value: 8080 },
        state.options.formatPlugins,
      );
    });

    it('falls back to projectPath when origin is writable but has no filePath', async () => {
      vi.mocked(resolveKeyOrigin).mockReturnValue({
        filePath: undefined,
        layer: undefined,
        isWritable: true,
        exists: false,
      });

      const state = createState({
        _config: { server: { port: 3000 } } as never,
        projectPath: '/fallback/config.json',
      });

      await mutateKey(state, 'server.port', 8080, undefined, 'mutable');

      expect(writeConfigFile).toHaveBeenCalledWith(
        '/fallback/config.json',
        { path: 'server.port', value: 8080 },
        state.options.formatPlugins,
      );
    });

    it('falls back to projectPath when origin is not writable but has filePath', async () => {
      vi.mocked(resolveKeyOrigin).mockReturnValue({
        filePath: '/origin/config.json',
        layer: undefined,
        isWritable: false,
        exists: true,
      });

      const state = createState({
        _config: { server: { port: 3000 } } as never,
        projectPath: '/fallback/config.json',
      });

      await mutateKey(state, 'server.port', 8080, undefined, 'mutable');

      expect(writeConfigFile).toHaveBeenCalledWith(
        '/fallback/config.json',
        { path: 'server.port', value: 8080 },
        state.options.formatPlugins,
      );
    });

    it('returns silently when no layer matches the resolved target file', async () => {
      vi.mocked(resolveKeyOrigin).mockReturnValue({
        filePath: '/fallback/config.json',
        layer: undefined,
        isWritable: false,
        exists: false,
      });

      const state = createState({
        _config: { server: { port: 3000 } } as never,
        projectPath: '/fallback/config.json',
        _layers: [
          {
            source: 'project',
            path: '/origin/config.json',
            config: {},
            exists: true,
            extendsPaths: [],
          },
        ] as never,
      });

      await mutateKey(state, 'server.port', 8080, undefined, 'mutable');

      expect(writeConfigFile).not.toHaveBeenCalled();
      expect(emitChanges).not.toHaveBeenCalled();
      expect(runWriteHooks).not.toHaveBeenCalled();
    });
  });

  describe('deleteKey', () => {
    it('throws when store is stopped', async () => {
      const state = createState({ stopped: true });

      await expect(
        deleteKey(state, 'foo', undefined, 'mutable'),
      ).rejects.toThrow('morsel: store is stopped');
    });

    it('returns false when key does not exist', async () => {
      vi.mocked(hasRemovedPathValue).mockReturnValue(false);

      const state = createState({
        _config: { server: {} } as never,
        _layers: [
          {
            source: 'project',
            path: '/project/config.json',
            config: {},
            exists: true,
            extendsPaths: [],
          },
        ] as never,
      });

      const deleted = await deleteKey(
        state,
        'server.nonexistent',
        undefined,
        'mutable',
      );

      expect(deleted).toBe(false);
    });

    it('removes key, emits events, and persists deletion', async () => {
      const state = createState({
        _config: { server: { port: 3000, host: 'localhost' } } as never,
        _layers: [
          {
            source: 'project',
            path: '/project/config.json',
            config: {},
            exists: true,
            extendsPaths: [],
          },
        ] as never,
      });

      const deleted = await deleteKey(
        state,
        'server.port',
        undefined,
        'mutable',
      );

      expect(deleted).toBe(true);
      expect(hasRemovedPathValue).toHaveBeenCalledWith(expect.any(Object), [
        'server',
        'port',
      ]);
      expect(emitChanges).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        state.listeners,
        state.wildcardListeners,
      );
    });

    it('writes to all project and global layers when target is all', async () => {
      const state = createState({
        _config: { server: { port: 3000 } } as never,
        _layers: [
          {
            source: 'global',
            path: '/global/config.json',
            config: {},
            exists: true,
            extendsPaths: [],
          },
          {
            source: 'project',
            path: '/project/config.json',
            config: {},
            exists: true,
            extendsPaths: [],
          },
        ] as never,
      });

      await deleteKey(state, 'server.port', 'all', 'mutable');

      expect(writeConfigFile).toHaveBeenCalledTimes(2);
      expect(writeConfigFile).toHaveBeenNthCalledWith(
        1,
        '/global/config.json',
        { isDelete: true, path: 'server.port' },
        state.options.formatPlugins,
      );
      expect(writeConfigFile).toHaveBeenNthCalledWith(
        2,
        '/project/config.json',
        { isDelete: true, path: 'server.port' },
        state.options.formatPlugins,
      );
    });

    it('rolls back config on write failure', async () => {
      vi.mocked(writeConfigFile).mockRejectedValue(new Error('EWRITE'));

      const state = createState({
        _config: { server: { port: 3000 } } as never,
        _layers: [
          {
            source: 'project',
            path: '/project/config.json',
            config: {},
            exists: true,
            extendsPaths: [],
          },
        ] as never,
      });

      await expect(
        deleteKey(state, 'server.port', undefined, 'mutable'),
      ).rejects.toThrow('EWRITE');

      expect(getPathValue(state._config, 'server.port')).toBe(3000);
    });

    it('writes to a single layer when target is project', async () => {
      const state = createState({
        _config: { server: { port: 3000 } } as never,
        _layers: [
          {
            source: 'global',
            path: '/global/config.json',
            config: {},
            exists: true,
            extendsPaths: [],
          },
          {
            source: 'project',
            path: '/project/config.json',
            config: {},
            exists: true,
            extendsPaths: [],
          },
        ] as never,
      });

      await deleteKey(state, 'server.port', 'project', 'mutable');

      expect(writeConfigFile).toHaveBeenCalledTimes(1);
      expect(writeConfigFile).toHaveBeenCalledWith(
        '/project/config.json',
        { isDelete: true, path: 'server.port' },
        state.options.formatPlugins,
      );
    });

    it('skips layers with undefined path when target is all', async () => {
      const state = createState({
        _config: { server: { port: 3000 } } as never,
        _layers: [
          {
            source: 'global',
            path: undefined,
            config: {},
            exists: true,
            extendsPaths: [],
          },
          {
            source: 'project',
            path: '/project/config.json',
            config: {},
            exists: true,
            extendsPaths: [],
          },
        ] as never,
      });

      await deleteKey(state, 'server.port', 'all', 'mutable');

      expect(writeConfigFile).toHaveBeenCalledTimes(1);
      expect(writeConfigFile).toHaveBeenCalledWith(
        '/project/config.json',
        { isDelete: true, path: 'server.port' },
        state.options.formatPlugins,
      );
    });

    it('writes to a single layer when target is global', async () => {
      vi.mocked(resolveKeyOrigin).mockReturnValue({
        filePath: '/global/config.json',
        layer: undefined,
        isWritable: true,
        exists: true,
      });

      const state = createState({
        _config: { server: { port: 3000 } } as never,
        _layers: [
          {
            source: 'global',
            path: '/global/config.json',
            config: {},
            exists: true,
            extendsPaths: [],
          },
          {
            source: 'project',
            path: '/project/config.json',
            config: {},
            exists: true,
            extendsPaths: [],
          },
        ] as never,
      });

      await deleteKey(state, 'server.port', 'global', 'mutable');

      expect(writeConfigFile).toHaveBeenCalledTimes(1);
      expect(writeConfigFile).toHaveBeenCalledWith(
        '/global/config.json',
        { isDelete: true, path: 'server.port' },
        state.options.formatPlugins,
      );
    });

    it('skips layers with non-project/non-global source when target is all', async () => {
      const state = createState({
        _config: { server: { port: 3000 } } as never,
        _layers: [
          {
            source: 'defaults',
            path: '/defaults/config.json',
            config: {},
            exists: true,
            extendsPaths: [],
          },
          {
            source: 'project',
            path: '/project/config.json',
            config: {},
            exists: true,
            extendsPaths: [],
          },
        ] as never,
      });

      await deleteKey(state, 'server.port', 'all', 'mutable');

      expect(writeConfigFile).toHaveBeenCalledTimes(1);
      expect(writeConfigFile).toHaveBeenCalledWith(
        '/project/config.json',
        { isDelete: true, path: 'server.port' },
        state.options.formatPlugins,
      );
    });

    it('calls runWriteHooks after successful delete with correct WriteEvent', async () => {
      const state = createState({
        _config: { server: { port: 3000 } } as never,
        _layers: [
          {
            source: 'global',
            path: '/global/config.json',
            config: {},
            exists: true,
            extendsPaths: [],
          },
          {
            source: 'project',
            path: '/project/config.json',
            config: {},
            exists: true,
            extendsPaths: [],
          },
        ] as never,
      });

      await deleteKey(state, 'server.port', 'all', 'mutable');

      expect(runWriteHooks).toHaveBeenCalledTimes(2);
      expect(runWriteHooks).toHaveBeenNthCalledWith(
        1,
        state.options.hooks,
        {
          filePath: '/global/config.json',
          keyPath: 'server.port',
          mutation: { isDelete: true, path: 'server.port' },
        },
        state.options.onDebug,
      );
      expect(runWriteHooks).toHaveBeenNthCalledWith(
        2,
        state.options.hooks,
        {
          filePath: '/project/config.json',
          keyPath: 'server.port',
          mutation: { isDelete: true, path: 'server.port' },
        },
        state.options.onDebug,
      );
    });

    it('does not call runWriteHooks on delete write failure', async () => {
      vi.mocked(writeConfigFile).mockRejectedValue(new Error('EWRITE'));

      const state = createState({
        _config: { server: { port: 3000 } } as never,
        _layers: [
          {
            source: 'project',
            path: '/project/config.json',
            config: {},
            exists: true,
            extendsPaths: [],
          },
        ] as never,
      });

      await expect(
        deleteKey(state, 'server.port', undefined, 'mutable'),
      ).rejects.toThrow('EWRITE');

      expect(runWriteHooks).not.toHaveBeenCalled();
    });
  });

  describe('setKey', () => {
    it('delegates to mutateKey', async () => {
      const state = createState({
        _config: { server: { port: 3000 } } as never,
        _layers: [
          {
            source: 'project',
            path: '/project/config.json',
            config: {},
            exists: true,
            extendsPaths: [],
          },
        ] as never,
      });

      await setKey(state, 'server.port', 8080, 'project', 'mutable');

      expect(writeConfigFile).toHaveBeenCalledWith(
        '/project/config.json',
        { path: 'server.port', value: 8080 },
        state.options.formatPlugins,
      );
    });
  });

  describe('unsetKey', () => {
    it('delegates to deleteKey', async () => {
      const state = createState({
        _config: { server: { port: 3000 } } as never,
        _layers: [
          {
            source: 'project',
            path: '/project/config.json',
            config: {},
            exists: true,
            extendsPaths: [],
          },
        ] as never,
      });

      const result = await unsetKey(state, 'server.port', 'all', 'mutable');

      expect(result).toBe(true);
      expect(writeConfigFile).toHaveBeenCalledWith(
        '/project/config.json',
        { isDelete: true, path: 'server.port' },
        state.options.formatPlugins,
      );
    });
  });
});
