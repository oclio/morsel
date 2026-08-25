import { runWriteHooks } from '@/hooks/run-hooks';
import { applyValidation } from '@/load/apply-validation';
import { applyMutability, mergeLayers } from '@/load/merge-layers';
import { interpolate } from '@/merge/interpolate';
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

describe('array-ops', () => {
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
    vi.mocked(runWriteHooks).mockResolvedValue(undefined);
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
