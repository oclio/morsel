import { createMockStoreState } from '@oclio/test-helpers';

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
  hasRemovedPathValue: vi.fn(),
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

  describe('mutateKey', () => {
    it('throws when store is stopped', async () => {
      const state = createState({ stopped: true });

      await expect(
        mutateKey(state, 'foo', 'bar', undefined, 'mutable'),
      ).rejects.toThrow('morsel: store is stopped');
    });
  });

  describe('deleteKey', () => {
    it('throws when store is stopped', async () => {
      const state = createState({ stopped: true });

      await expect(
        deleteKey(state, 'foo', undefined, 'mutable'),
      ).rejects.toThrow('morsel: store is stopped');
    });
  });

  describe('setKey', () => {
    it('delegates to mutateKey', async () => {
      const state = createState({
        _config: { server: { port: 3000 } } as never,
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

  describe('writeQueue serialization', () => {
    it('serializes concurrent mutations via writeQueue', async () => {
      let writeCount = 0;
      vi.mocked(writeConfigFile).mockImplementation(async () => {
        writeCount++;
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      const state = createState({
        _config: { server: { port: 3000 } } as never,
      });

      await Promise.all([
        mutateKey(state, 'a', 1, undefined, 'mutable'),
        mutateKey(state, 'b', 2, undefined, 'mutable'),
      ]);

      expect(writeCount).toBe(2);
    });

    it('isolates errors: failed mutation does not block subsequent mutations', async () => {
      let callCount = 0;
      vi.mocked(writeConfigFile).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('EWRITE');
        }
      });

      const state = createState({
        _config: { server: { port: 3000 } } as never,
      });

      const results = await Promise.allSettled([
        mutateKey(state, 'a', 1, undefined, 'mutable'),
        mutateKey(state, 'b', 2, undefined, 'mutable'),
      ]);

      expect(results[0].status).toBe('rejected');
      expect(results[1].status).toBe('fulfilled');
      expect(writeConfigFile).toHaveBeenCalledTimes(2);
    });

    it('updates writeQueue after each mutation', async () => {
      const state = createState({
        _config: { server: { port: 3000 } } as never,
      });

      const initialQueue = state.writeQueue;
      await mutateKey(state, 'a', 1, undefined, 'mutable');
      expect(state.writeQueue).not.toBe(initialQueue);
    });

    it('stop() awaits writeQueue before closing watchers', async () => {
      const { stopStore } = await import('@/store/boot/stop-store');
      const writeDelay = 50;
      vi.mocked(writeConfigFile).mockImplementation(
        async () =>
          await new Promise((resolve) => setTimeout(resolve, writeDelay)),
      );

      const state = createState({
        _config: { server: { port: 3000 } } as never,
        options: {
          hooks: [],
          watch: true,
          proxy: true,
          queue: true,
          onDebug: vi.fn(),
        } as never,
      });

      const writePromise = mutateKey(state, 'a', 1, undefined, 'mutable');
      const stopPromise = stopStore(state);

      await Promise.all([writePromise, stopPromise]);

      expect(state.stopped).toBe(true);
    });
  });

  describe('queue: false — bypass write queue', () => {
    it('executes mutations directly without chainMutation when queueEnabled is false', async () => {
      vi.mocked(writeConfigFile).mockResolvedValue(undefined);

      const state = createState({
        _config: { server: { port: 3000 } } as never,
        queueEnabled: false,
        inTransaction: false,
        transactionDirtyKeys: new Map(),
      });

      const initialQueue = state.writeQueue;
      await mutateKey(state, 'a', 1, undefined, 'mutable');

      expect(writeConfigFile).toHaveBeenCalledTimes(1);
      expect(state.writeQueue).toBe(initialQueue);
    });

    it('does not serialize concurrent mutations when queueEnabled is false', async () => {
      const order: string[] = [];
      vi.mocked(writeConfigFile).mockImplementation(async () => {
        order.push('write');
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      const state = createState({
        _config: { server: { port: 3000 } } as never,
        queueEnabled: false,
        inTransaction: false,
        transactionDirtyKeys: new Map(),
      });

      await Promise.all([
        mutateKey(state, 'a', 1, undefined, 'mutable'),
        mutateKey(state, 'b', 2, undefined, 'mutable'),
      ]);

      expect(writeConfigFile).toHaveBeenCalledTimes(2);
      expect(order).toHaveLength(2);
      expect(order).toEqual(['write', 'write']);
    });

    it('deleteKey also bypasses queue when queueEnabled is false', async () => {
      vi.mocked(writeConfigFile).mockResolvedValue(undefined);

      const state = createState({
        _config: { server: { port: 3000 } } as never,
        queueEnabled: false,
        inTransaction: false,
        transactionDirtyKeys: new Map(),
      });

      const initialQueue = state.writeQueue;
      await deleteKey(state, 'a', undefined, 'mutable');

      expect(state.writeQueue).toBe(initialQueue);
    });

    it('deleteKey uses queue when queueEnabled is true', async () => {
      vi.mocked(writeConfigFile).mockResolvedValue(undefined);

      const state = createState({
        _config: { server: { port: 3000 } } as never,
        queueEnabled: true,
        inTransaction: false,
        transactionDirtyKeys: new Map(),
      });

      const initialQueue = state.writeQueue;
      await deleteKey(state, 'a', undefined, 'mutable');

      expect(state.writeQueue).not.toBe(initialQueue);
    });
  });

  describe('inTransaction — bypass write queue', () => {
    it('mutateKey bypasses queue when inTransaction is true', async () => {
      vi.mocked(writeConfigFile).mockResolvedValue(undefined);

      const state = createState({
        _config: { server: { port: 3000 } } as never,
        queueEnabled: true,
        inTransaction: true,
        transactionDirtyKeys: new Map(),
      });

      const initialQueue = state.writeQueue;
      await mutateKey(state, 'a', 1, undefined, 'mutable');

      expect(state.writeQueue).toBe(initialQueue);
    });

    it('deleteKey bypasses queue when inTransaction is true', async () => {
      vi.mocked(writeConfigFile).mockResolvedValue(undefined);

      const state = createState({
        _config: { server: { port: 3000 } } as never,
        queueEnabled: true,
        inTransaction: true,
        transactionDirtyKeys: new Map(),
      });

      const initialQueue = state.writeQueue;
      await deleteKey(state, 'a', undefined, 'mutable');

      expect(state.writeQueue).toBe(initialQueue);
    });
  });
});
