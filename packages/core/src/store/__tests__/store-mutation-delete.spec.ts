import { createMockStoreState, setupStoreMocks } from '@oclio/test-helpers';

import { runWriteHooks } from '@/hooks/run-hooks';
import { applyValidation } from '@/load/apply-validation';
import { applyMutability, mergeLayers } from '@/load/merge-layers';
import { interpolateInPlace } from '@/merge/interpolate';
import { parsePath } from '@/paths/parse-path';
import { getPathValue, hasRemovedPathValue } from '@/paths/path-access';
import { toMorselLayer } from '@/store/layer';
import { emitChanges } from '@/store/reactive/emit-changes';
import { doDeleteKey } from '@/store/store-mutation-delete';
import type { StoreState } from '@/store/store-state';
import { deepClone } from '@/utils/deep-clone';
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
  interpolateInPlace: vi.fn(),
}));
vi.mock('@/paths/parse-path', () => ({
  parsePath: vi.fn(),
}));
vi.mock('@/paths/path-access', () => ({
  getPathValue: vi.fn(),
  hasRemovedPathValue: vi.fn(),
}));
vi.mock('@/store/layer', () => ({
  toMorselLayer: vi.fn(),
}));
vi.mock('@/store/reactive/emit-changes', () => ({
  emitChanges: vi.fn(),
}));
vi.mock('@/utils/deep-clone', () => ({
  deepClone: vi.fn(),
}));
vi.mock('@/store/store-transaction', () => ({
  trackDirtyKey: vi.fn(),
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
  return createMockStoreState<T>({
    _config: { foo: 'bar' } as unknown as T,
    _layers: [
      {
        source: 'project',
        path: projectPath,
        config: {},
        exists: true,
        extendsPaths: [],
      },
    ],
    projectPath,
    ...overrides,
  }) as unknown as StoreState<T>;
}

describe('store-mutation-delete', () => {
  beforeEach(() => {
    setupStoreMocks({
      applyValidation,
      applyMutability,
      mergeLayers,
      interpolateInPlace,
      toMorselLayer,
      deepClone,
      parsePath,
      hasRemovedPathValue,
      getPathValue,
      emitChanges,
      resolveKeyOrigin,
      writeConfigFile,
      runWriteHooks,
    });
  });

  it('returns false when key does not exist', async () => {
    vi.mocked(hasRemovedPathValue).mockReturnValue(false);

    const state = createState({
      _config: { server: {} } as never,
    });

    const deleted = await doDeleteKey(
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
    });

    const deleted = await doDeleteKey(
      state,
      'server.port',
      undefined,
      'mutable',
    );

    expect(deleted).toBe(true);
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

    await doDeleteKey(state, 'server.port', 'all', 'mutable');

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
    });

    await expect(
      doDeleteKey(state, 'server.port', undefined, 'mutable'),
    ).rejects.toThrow('EWRITE');

    expect(getPathValue(state._config, 'server.port')).toBe(3000);
  });

  it('does not call runWriteHooks on delete write failure', async () => {
    vi.mocked(writeConfigFile).mockRejectedValue(new Error('EWRITE'));

    const state = createState({
      _config: { server: { port: 3000 } } as never,
    });

    await expect(
      doDeleteKey(state, 'server.port', undefined, 'mutable'),
    ).rejects.toThrow('EWRITE');

    expect(runWriteHooks).not.toHaveBeenCalled();
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

    await doDeleteKey(state, 'server.port', 'project', 'mutable');

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

    await doDeleteKey(state, 'server.port', 'all', 'mutable');

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

    await doDeleteKey(state, 'server.port', 'global', 'mutable');

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

    await doDeleteKey(state, 'server.port', 'all', 'mutable');

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

    await doDeleteKey(state, 'server.port', 'all', 'mutable');

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

  it('skips write and events during transaction, tracks dirty key', async () => {
    const { trackDirtyKey } = await import('@/store/store-transaction');
    vi.mocked(hasRemovedPathValue).mockReturnValue(true);
    const state = createState({
      _config: { server: { port: 3000 } } as never,
      inTransaction: true,
      transactionDirtyKeys: new Map(),
    });

    const result = await doDeleteKey(state, 'server.port', 'all', 'mutable');

    expect(result).toBe(true);
    expect(writeConfigFile).not.toHaveBeenCalled();
    expect(emitChanges).not.toHaveBeenCalled();
    expect(runWriteHooks).not.toHaveBeenCalled();
    expect(trackDirtyKey).toHaveBeenCalledWith(
      state,
      '/project/config.json',
      'server.port',
    );
  });

  it('returns false during transaction when key does not exist', async () => {
    const { trackDirtyKey } = await import('@/store/store-transaction');
    vi.mocked(hasRemovedPathValue).mockReturnValue(false);
    const state = createState({
      _config: { server: { port: 3000 } } as never,
      inTransaction: true,
      transactionDirtyKeys: new Map(),
    });

    const result = await doDeleteKey(state, 'server.port', 'all', 'mutable');

    expect(result).toBe(false);
    expect(writeConfigFile).not.toHaveBeenCalled();
    expect(trackDirtyKey).not.toHaveBeenCalled();
  });
});
