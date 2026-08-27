import { createMockStoreState } from '@oclio/test-helpers';

import { runWriteHooks } from '@/hooks/run-hooks';
import { applyValidation } from '@/load/apply-validation';
import { applyMutability, mergeLayers } from '@/load/merge-layers';
import { interpolate } from '@/merge/interpolate';
import { parsePath } from '@/paths/parse-path';
import { getPathValue, setPathValue } from '@/paths/path-access';
import { toMorselLayer } from '@/store/layer';
import { emitChanges } from '@/store/reactive/emit-changes';
import { doMutateKey } from '@/store/store-mutation-set';
import type { StoreState } from '@/store/store-state';
import type { MorselLayer } from '@/store/types';
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
  interpolate: vi.fn(),
}));
vi.mock('@/paths/parse-path', () => ({
  parsePath: vi.fn(),
}));
vi.mock('@/paths/path-access', () => ({
  getPathValue: vi.fn(),
  setPathValue: vi.fn(),
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

describe('store-mutation-set', () => {
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
    vi.mocked(deepClone).mockImplementation(
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
        path: '/project/config.json',
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

  it('calls writeConfigFile with correct arguments', async () => {
    const state = createState({
      _config: { server: { port: 3000 } } as never,
    });

    await doMutateKey(state, 'server.port', 8080, undefined, 'mutable');

    expect(writeConfigFile).toHaveBeenCalledWith(
      '/project/config.json',
      { path: 'server.port', value: 8080 },
      state.options.formatPlugins,
    );
  });

  it('calls runWriteHooks after successful write', async () => {
    const state = createState({
      _config: { server: { port: 3000 } } as never,
    });

    await doMutateKey(state, 'server.port', 8080, undefined, 'mutable');

    expect(runWriteHooks).toHaveBeenCalledWith(
      state.options.hooks,
      {
        filePath: '/project/config.json',
        keyPath: 'server.port',
        mutation: { path: 'server.port', value: 8080 },
      },
      state.options.onDebug,
    );
  });

  it('rolls back config on write failure', async () => {
    vi.mocked(writeConfigFile).mockRejectedValue(new Error('EWRITE'));

    const state = createState({
      _config: { server: { port: 3000 } } as never,
    });

    await expect(
      doMutateKey(state, 'server.port', 8080, undefined, 'mutable'),
    ).rejects.toThrow('EWRITE');

    expect(getPathValue(state._config, 'server.port')).toBe(3000);
  });

  it('does not call runWriteHooks on write failure', async () => {
    vi.mocked(writeConfigFile).mockRejectedValue(new Error('EWRITE'));

    const state = createState({
      _config: { server: { port: 3000 } } as never,
    });

    await expect(
      doMutateKey(state, 'server.port', 8080, undefined, 'mutable'),
    ).rejects.toThrow('EWRITE');

    expect(runWriteHooks).not.toHaveBeenCalled();
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

    await doMutateKey(state, 'server.port', 8080, undefined, 'mutable');

    expect(writeConfigFile).not.toHaveBeenCalled();
    expect(emitChanges).not.toHaveBeenCalled();
    expect(runWriteHooks).not.toHaveBeenCalled();
  });

  it('skips write and events during transaction, tracks dirty key', async () => {
    const { trackDirtyKey } = await import('@/store/store-transaction');
    const state = createState({
      _config: { server: { port: 3000 } } as never,
      inTransaction: true,
      transactionDirtyKeys: new Map(),
    });

    await doMutateKey(state, 'server.port', 8080, undefined, 'mutable');

    expect(setPathValue).toHaveBeenCalledWith(
      expect.any(Object),
      ['server', 'port'],
      8080,
    );
    expect(state._config).toEqual({ server: { port: 8080 } });
    expect(writeConfigFile).not.toHaveBeenCalled();
    expect(emitChanges).not.toHaveBeenCalled();
    expect(runWriteHooks).not.toHaveBeenCalled();
    expect(trackDirtyKey).toHaveBeenCalledWith(
      state,
      '/project/config.json',
      'server.port',
    );
  });
});
