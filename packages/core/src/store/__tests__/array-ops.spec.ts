import { createMockStoreState, setupStoreMocks } from '@oclio/test-helpers';

import { runWriteHooks } from '@/hooks/run-hooks';
import { applyValidation } from '@/load/apply-validation';
import { applyMutability, mergeLayers } from '@/load/merge-layers';
import { interpolateInPlace } from '@/merge/interpolate';
import { parsePath } from '@/paths/parse-path';
import { getPathValue, setPathValue } from '@/paths/path-access';
import {
  popKey,
  pushKey,
  shiftKey,
  spliceKey,
  unshiftKey,
} from '@/store/array-ops';
import { toMorselLayer } from '@/store/layer';
import { emitChanges } from '@/store/reactive/emit-changes';
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

describe('array-ops', () => {
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
      getPathValue,
      emitChanges,
      resolveKeyOrigin,
      writeConfigFile,
      runWriteHooks,
    });
    vi.mocked(resolveKeyOrigin).mockReturnValue({
      filePath: '/project/config.json',
      layer: undefined,
      isWritable: true,
      exists: true,
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

      expect(listener).toHaveBeenCalledWith({
        keyPath: 'tags.1',
        type: 'added',
        next: 'b',
        prev: undefined,
      });
    });
  });

  describe('unshiftKey', () => {
    it('unshifts a value and returns the new array length', async () => {
      const state = createState({
        _config: { tags: ['b', 'c'] } as never,
      });

      const index = await unshiftKey(state, 'tags', 'a', undefined, 'mutable');

      expect(index).toBe(3);
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
