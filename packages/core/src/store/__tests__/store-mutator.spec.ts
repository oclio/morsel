import { createMockStoreState, setupStoreMocks } from '@oclio/test-helpers';

import { runWriteHooks } from '@/hooks/run-hooks';
import { applyValidation } from '@/load/apply-validation';
import { applyMutability, mergeLayers } from '@/load/merge-layers';
import { interpolateInPlace } from '@/merge/interpolate';
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
    setupStoreMocks({
      applyValidation,
      applyMutability,
      mergeLayers,
      interpolateInPlace,
      toMorselLayer,
      deepClone,
      parsePath,
      setPathValue,
      hasRemovedPathValue,
      getPathValue,
      emitChanges,
      resolveKeyOrigin,
      writeConfigFile,
      runWriteHooks,
    });
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
