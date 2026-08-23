import { applyMutability } from '@/load/merge-layers';
import { parsePath } from '@/paths/parse-path';
import {
  getPathValue,
  hasRemovedPathValue,
  setPathValue,
} from '@/paths/path-access';
import { emitChanges } from '@/store/emit-changes';
import {
  deleteKey,
  mutateKey,
  popKey,
  pushKey,
  shiftKey,
  spliceKey,
  unshiftKey,
} from '@/store/store-mutator';
import type { StoreState } from '@/store/store-state';
import { deepCloneConfig } from '@/store/store-state';
import { resolveKeyOrigin } from '@/writer/resolve-origin';
import { writeConfigFile } from '@/writer/write-config';

vi.mock('@/load/merge-layers', () => ({
  applyMutability: vi.fn(),
}));
vi.mock('@/paths/parse-path', () => ({
  parsePath: vi.fn(),
}));
vi.mock('@/paths/path-access', () => ({
  getPathValue: vi.fn(),
  hasRemovedPathValue: vi.fn(),
  setPathValue: vi.fn(),
}));
vi.mock('@/store/emit-changes', () => ({
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
  return {
    _config: { foo: 'bar' } as unknown as T,
    _proxy: undefined,
    _stoppedConfig: undefined,
    _layers: [],
    listeners: new Map(),
    stopped: false,
    watchers: new Set(),
    watchedFiles: new Map(),
    projectPath: '/project/config.json',
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
    vi.mocked(applyMutability).mockImplementation((config) => config);
    vi.mocked(deepCloneConfig).mockImplementation(
      (config) => structuredClone(config) as Record<string, unknown>,
    );
    vi.mocked(parsePath).mockImplementation((path) =>
      typeof path === 'string' ? path.split('.') : [...path],
    );
    vi.mocked(setPathValue).mockImplementation((object, segments, value) => {
      let current = object as Record<string, unknown>;
      for (let index = 0; index < segments.length - 1; index++) {
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
      layer: undefined,
      isWritable: true,
      exists: true,
    });
    vi.mocked(writeConfigFile).mockResolvedValue(undefined);
  });

  describe('mutateKey', () => {
    it('throws when store is stopped', async () => {
      const state = createState({ stopped: true });

      await expect(
        mutateKey(state, 'foo', 'bar', undefined, 'mutable'),
      ).rejects.toThrow('morsel: store is stopped');
    });

    it('updates config optimistically and emits change events', async () => {
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

      expect(setPathValue).toHaveBeenCalledWith(
        expect.any(Object),
        ['server', 'port'],
        8080,
      );
      expect(emitChanges).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        state.listeners,
      );
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
            path: '/project/config.json',
            config: {},
            exists: true,
            extendsPaths: [],
          },
        ] as never,
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

    it('emits rollback events to listeners on write failure', async () => {
      vi.mocked(writeConfigFile).mockRejectedValue(new Error('EWRITE'));

      const state = createState({
        _config: { server: { port: 3000 } } as never,
      });

      await expect(
        mutateKey(state, 'server.port', 8080, undefined, 'mutable'),
      ).rejects.toThrow('EWRITE');

      expect(emitChanges).toHaveBeenCalledTimes(2);
      expect(emitChanges).toHaveBeenNthCalledWith(
        1,
        expect.any(Object),
        expect.any(Object),
        state.listeners,
      );
      expect(emitChanges).toHaveBeenNthCalledWith(
        2,
        expect.any(Object),
        expect.any(Object),
        state.listeners,
      );
    });

    it('skips rollback when config changed during await (concurrent re-merge)', async () => {
      const remergedConfig = { server: { port: 9999 } } as never;
      vi.mocked(writeConfigFile).mockImplementation(async () => {
        state._config = remergedConfig;
        throw new Error('EWRITE');
      });

      const state = createState({
        _config: { server: { port: 3000 } } as never,
      });

      await expect(
        mutateKey(state, 'server.port', 8080, undefined, 'mutable'),
      ).rejects.toThrow('EWRITE');

      expect(state._config).toBe(remergedConfig);
      expect(emitChanges).toHaveBeenCalledTimes(1);
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

    it('emits rollback events to listeners on write failure', async () => {
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

      expect(emitChanges).toHaveBeenCalledTimes(2);
      expect(emitChanges).toHaveBeenNthCalledWith(
        1,
        expect.any(Object),
        expect.any(Object),
        state.listeners,
      );
      expect(emitChanges).toHaveBeenNthCalledWith(
        2,
        expect.any(Object),
        expect.any(Object),
        state.listeners,
      );
    });

    it('skips rollback when config changed during await (concurrent re-merge)', async () => {
      const remergedConfig = { server: { port: 9999 } } as never;
      vi.mocked(writeConfigFile).mockImplementation(async () => {
        state._config = remergedConfig;
        throw new Error('EWRITE');
      });

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

      expect(state._config).toBe(remergedConfig);
      expect(emitChanges).toHaveBeenCalledTimes(1);
    });
  });

  describe('pushKey', () => {
    it('pushes a value and returns the new index', async () => {
      const state = createState({
        _config: { tags: ['a', 'b'] } as never,
      });

      const index = await pushKey(state, 'tags', 'c', undefined, 'mutable');

      expect(index).toBe(2);
      expect(getPathValue(state._config, 'tags')).toEqual(['a', 'b', 'c']);
    });

    it('emits index listener for the new element', async () => {
      const listener = vi.fn();
      const state = createState({
        _config: { tags: ['a'] } as never,
      });
      state.listeners.set('tags.1', new Set([listener as never]));

      await pushKey(state, 'tags', 'b', undefined, 'mutable');

      expect(listener).toHaveBeenCalledWith('b', undefined);
    });
  });

  describe('unshiftKey', () => {
    it('unshifts a value and returns 0', async () => {
      const state = createState({
        _config: { tags: ['b', 'c'] } as never,
      });

      const index = await unshiftKey(state, 'tags', 'a', undefined, 'mutable');

      expect(index).toBe(0);
      expect(getPathValue(state._config, 'tags')).toEqual(['a', 'b', 'c']);
    });
  });

  describe('popKey', () => {
    it('pops the last element and returns it', async () => {
      const state = createState({
        _config: { tags: ['a', 'b', 'c'] } as never,
      });

      const removed = await popKey(state, 'tags', undefined, 'mutable');

      expect(removed).toBe('c');
      expect(getPathValue(state._config, 'tags')).toEqual(['a', 'b']);
    });
  });

  describe('shiftKey', () => {
    it('shifts the first element and returns it', async () => {
      const state = createState({
        _config: { tags: ['a', 'b', 'c'] } as never,
      });

      const removed = await shiftKey(state, 'tags', undefined, 'mutable');

      expect(removed).toBe('a');
      expect(getPathValue(state._config, 'tags')).toEqual(['b', 'c']);
    });
  });

  describe('spliceKey', () => {
    it('removes and inserts elements', async () => {
      const state = createState({
        _config: { tags: ['a', 'b', 'c', 'd'] } as never,
      });

      const removed = await spliceKey(
        state,
        'tags',
        1,
        2,
        ['x', 'y'],
        undefined,
        'mutable',
      );

      expect(removed).toEqual(['b', 'c']);
      expect(getPathValue(state._config, 'tags')).toEqual(['a', 'x', 'y', 'd']);
    });

    it('removes only when no items provided', async () => {
      const state = createState({
        _config: { tags: ['a', 'b', 'c'] } as never,
      });

      const removed = await spliceKey(
        state,
        'tags',
        0,
        2,
        [],
        undefined,
        'mutable',
      );

      expect(removed).toEqual(['a', 'b']);
      expect(getPathValue(state._config, 'tags')).toEqual(['c']);
    });
  });

  describe('array mutators — type validation', () => {
    it.each([
      {
        name: 'pushKey',
        fn: (s: StoreState) => pushKey(s, 'name', 'x', undefined, 'mutable'),
      },
      {
        name: 'unshiftKey',
        fn: (s: StoreState) => unshiftKey(s, 'name', 'x', undefined, 'mutable'),
      },
      {
        name: 'popKey',
        fn: (s: StoreState) => popKey(s, 'name', undefined, 'mutable'),
      },
      {
        name: 'shiftKey',
        fn: (s: StoreState) => shiftKey(s, 'name', undefined, 'mutable'),
      },
      {
        name: 'spliceKey',
        fn: (s: StoreState) =>
          spliceKey(s, 'name', 0, 1, [], undefined, 'mutable'),
      },
    ])(
      'throws EVALIDATE when target is not an array ($name)',
      async ({ fn }) => {
        const state = createState({
          _config: { name: 'morsel' } as never,
        });

        await expect(fn(state)).rejects.toThrow('EVALIDATE');
        await expect(fn(state)).rejects.toThrow('"name" is not an array');
      },
    );
  });
});
