import {
  popKey,
  pushKey,
  shiftKey,
  spliceKey,
  unshiftKey,
} from '@/store/array-ops';
import { createArrayMethods } from '@/store/store-array-methods';
import type { StoreState } from '@/store/store-state';

vi.mock('@/store/array-ops', async () => {
  const actual =
    await vi.importActual<typeof import('@/store/array-ops')>(
      '@/store/array-ops',
    );
  return {
    ...actual,
    popKey: vi.fn(),
    pushKey: vi.fn(),
    shiftKey: vi.fn(),
    spliceKey: vi.fn(),
    unshiftKey: vi.fn(),
  };
});

function createState<T extends Record<string, unknown>>(
  overrides: Partial<StoreState<T>> = {},
): StoreState<T> {
  return {
    _config: { foo: 'bar' } as unknown as T,
    _proxy: undefined,
    _stoppedConfig: undefined,
    _layers: [],
    listeners: new Map(),
    wildcardListeners: new Map(),
    stopped: false,
    watchers: new Set(),
    watchedFiles: new Map(),
    projectPath: '/project/config.json',
    options: { hooks: [] } as never,
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

describe('createArrayMethods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('push', () => {
    it('delegates to pushKey with state, path, value, target, and mutability', async () => {
      vi.mocked(pushKey).mockResolvedValue(2);
      const state = createState();
      const methods = createArrayMethods(state, 'frozen');

      const result = await methods.push('tags', 'new', 'project');

      expect(result).toBe(2);
      expect(pushKey).toHaveBeenCalledWith(
        state,
        'tags',
        'new',
        'project',
        'frozen',
      );
    });
  });

  describe('unshift', () => {
    it('delegates to unshiftKey with state, path, value, target, and mutability', async () => {
      vi.mocked(unshiftKey).mockResolvedValue(0);
      const state = createState();
      const methods = createArrayMethods(state, 'frozen');

      const result = await methods.unshift('tags', 'new');

      expect(result).toBe(0);
      expect(unshiftKey).toHaveBeenCalledWith(
        state,
        'tags',
        'new',
        undefined,
        'frozen',
      );
    });
  });

  describe('pop and shift', () => {
    it.each([
      {
        name: 'pop',
        fn: popKey,
        call: (m: ReturnType<typeof createArrayMethods>) => m.pop('tags'),
      },
      {
        name: 'shift',
        fn: shiftKey,
        call: (m: ReturnType<typeof createArrayMethods>) => m.shift('tags'),
      },
    ])(
      'delegates to $name with state, path, target, and mutability',
      async ({ fn, call }) => {
        vi.mocked(fn).mockResolvedValue('removed');
        const state = createState();
        const methods = createArrayMethods(state, 'frozen');

        const result = await call(methods);

        expect(result).toBe('removed');
        expect(fn).toHaveBeenCalledWith(state, 'tags', undefined, 'frozen');
      },
    );
  });

  describe('splice', () => {
    it('delegates to spliceKey with state, path, start, deleteCount, items, and mutability', async () => {
      vi.mocked(spliceKey).mockResolvedValue(['removed']);
      const state = createState();
      const methods = createArrayMethods(state, 'frozen');

      const result = await methods.splice('tags', 1, 2, 'a', 'b');

      expect(result).toEqual(['removed']);
      expect(spliceKey).toHaveBeenCalledWith(
        state,
        'tags',
        1,
        2,
        ['a', 'b'],
        undefined,
        'frozen',
      );
    });
  });

  describe('indexOf and lastIndexOf', () => {
    it.each([
      {
        method: 'indexOf' as const,
        config: { tags: ['a', 'b', 'a'] },
        path: 'tags',
        value: 'a',
        expected: 0,
      },
      {
        method: 'indexOf' as const,
        config: { tags: ['a', 'b'] },
        path: 'tags',
        value: 'z',
        expected: -1,
      },
      {
        method: 'lastIndexOf' as const,
        config: { tags: ['a', 'b', 'a'] },
        path: 'tags',
        value: 'a',
        expected: 2,
      },
      {
        method: 'lastIndexOf' as const,
        config: { tags: ['a', 'b'] },
        path: 'tags',
        value: 'z',
        expected: -1,
      },
    ])(
      '$method returns $expected for $path with value $value',
      ({ method, config, path, value, expected }) => {
        const state = createState({
          _config: config as never,
        });
        const methods = createArrayMethods(state, 'frozen');

        const result =
          method === 'indexOf'
            ? methods.indexOf(path, value)
            : methods.lastIndexOf(path, value);

        expect(result).toBe(expected);
      },
    );

    it.each([
      { method: 'indexOf' as const, config: { name: 'morsel' } },
      { method: 'lastIndexOf' as const, config: { name: 'morsel' } },
    ])(
      '$method throws MorselError(EVALIDATE) on non-array key',
      ({ method, config }) => {
        const state = createState({
          _config: config as never,
        });
        const methods = createArrayMethods(state, 'frozen');

        expect(() =>
          method === 'indexOf'
            ? methods.indexOf('name', 'morsel')
            : methods.lastIndexOf('name', 'morsel'),
        ).toThrow(
          expect.objectContaining({ name: 'MorselError', code: 'EVALIDATE' }),
        );
      },
    );
  });
});
