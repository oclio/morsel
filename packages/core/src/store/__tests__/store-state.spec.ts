import { isPlainObject } from '@/merge/merge-helpers';
import type { ResolvedOptions } from '@/store/boot/assert-name';
import { createStoreState } from '@/store/store-state';
import { deepClone } from '@/utils/deep-clone';

vi.mock('@/merge/merge-helpers', () => ({
  isPlainObject: vi.fn(),
}));

import { createMockLayer } from '@oclio/test-helpers';

import type { MorselLayer } from '@/store/types';

const mockOptions = {
  name: 'myapp',
  cwd: '/project',
  defaults: {},
  overrides: {},
  globalDir: '/global',
  arrayMerge: 'replace',
  envName: 'test',
  configMutability: 'frozen',
  verbose: false,
  onDebug: vi.fn(),
  formatPlugins: [],
  validationPlugins: [],
  hooks: [],
  watch: true,
  proxy: true,
  queue: true,
} as ResolvedOptions;

function makeLayer(overrides: Partial<MorselLayer> = {}): MorselLayer {
  return createMockLayer({
    path: '/path/to/config.json',
    ...overrides,
  }) as MorselLayer;
}

describe('createStoreState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isPlainObject).mockImplementation(
      (value) =>
        typeof value === 'object' &&
        value !== null &&
        Object.getPrototypeOf(value) === Object.prototype,
    );
  });

  it('initializes with provided config', () => {
    const config = { foo: 'bar' };
    const state = createStoreState(
      config,
      [],
      '/project/config.json',
      mockOptions,
      300,
      vi.fn(),
    );

    expect(state._config).toBe(config);
  });

  it('initializes _proxy as undefined', () => {
    const state = createStoreState(
      {},
      [],
      '/project/config.json',
      mockOptions,
      300,
      vi.fn(),
    );

    expect(state._proxy).toBeUndefined();
  });

  it('initializes _stoppedConfig as undefined', () => {
    const state = createStoreState(
      {},
      [],
      '/project/config.json',
      mockOptions,
      300,
      vi.fn(),
    );

    expect(state._stoppedConfig).toBeUndefined();
  });

  it('stores provided layers', () => {
    const layers = [makeLayer()];
    const state = createStoreState(
      {},
      layers,
      '/project/config.json',
      mockOptions,
      300,
      vi.fn(),
    );

    expect(state._layers).toBe(layers);
  });

  it('initializes empty listeners map', () => {
    const state = createStoreState(
      {},
      [],
      '/project/config.json',
      mockOptions,
      300,
      vi.fn(),
    );

    expect(state.listeners).toBeInstanceOf(Map);
    expect(state.listeners.size).toBe(0);
  });

  it('initializes stopped as false', () => {
    const state = createStoreState(
      {},
      [],
      '/project/config.json',
      mockOptions,
      300,
      vi.fn(),
    );

    expect(state.stopped).toBe(false);
  });

  it('initializes empty watchers set', () => {
    const state = createStoreState(
      {},
      [],
      '/project/config.json',
      mockOptions,
      300,
      vi.fn(),
    );

    expect(state.watchers).toBeInstanceOf(Set);
    expect(state.watchers.size).toBe(0);
  });

  it('initializes watchedFiles with resolved projectPath (relative)', () => {
    const state = createStoreState(
      {},
      [],
      'relative/config.json',
      mockOptions,
      300,
      vi.fn(),
    );

    expect(state.watchedFiles.size).toBe(1);
    const entry = [...state.watchedFiles.entries()][0];
    expect(entry).toBeDefined();
    const [directory, basenames] = entry as [string, Set<string>];
    expect(directory).toContain('relative');
    expect(basenames.has('config.json')).toBe(true);
  });

  it('initializes watchedFiles with resolved projectPath (absolute)', () => {
    const state = createStoreState(
      {},
      [],
      '/project/config.json',
      mockOptions,
      300,
      vi.fn(),
    );

    expect(state.watchedFiles.size).toBe(1);
    const entry = [...state.watchedFiles.entries()][0];
    expect(entry).toBeDefined();
    const [directory, basenames] = entry as [string, Set<string>];
    expect(directory).toBe('/project');
    expect(basenames.has('config.json')).toBe(true);
  });

  it('adds existing layer paths to watchedFiles', () => {
    const layers = [
      makeLayer({ path: '/layer1.json', exists: true }),
      makeLayer({ path: '/layer2.json', exists: true }),
    ];
    const state = createStoreState(
      {},
      layers,
      '/project/config.json',
      mockOptions,
      300,
      vi.fn(),
    );

    expect(state.watchedFiles.size).toBe(2);
    expect(state.watchedFiles.get('/')?.has('layer1.json')).toBe(true);
    expect(state.watchedFiles.get('/')?.has('layer2.json')).toBe(true);
    expect(state.watchedFiles.get('/project')?.has('config.json')).toBe(true);
  });

  it('skips layers with undefined path', () => {
    const layers = [makeLayer({ path: undefined, exists: true })];
    const state = createStoreState(
      {},
      layers,
      '/project/config.json',
      mockOptions,
      300,
      vi.fn(),
    );

    expect(state.watchedFiles.size).toBe(1);
  });

  it('skips layers with exists false', () => {
    const layers = [makeLayer({ path: '/layer.json', exists: false })];
    const state = createStoreState(
      {},
      layers,
      '/project/config.json',
      mockOptions,
      300,
      vi.fn(),
    );

    expect(state.watchedFiles.size).toBe(1);
  });

  it('stores projectPath', () => {
    const state = createStoreState(
      {},
      [],
      '/my/config.json',
      mockOptions,
      300,
      vi.fn(),
    );

    expect(state.projectPath).toBe('/my/config.json');
  });

  it('handles undefined projectPath without adding to watchedFiles', () => {
    const state = createStoreState(
      {},
      [],
      undefined,
      mockOptions,
      300,
      vi.fn(),
    );

    expect(state.projectPath).toBeUndefined();
    expect(state.watchedFiles.size).toBe(0);
  });

  it('clones config into lastConfig in mutable mode', () => {
    const config = { foo: 'bar' };
    const state = createStoreState(
      config,
      [],
      '/project/config.json',
      { ...mockOptions, configMutability: 'mutable' },
      300,
      vi.fn(),
    );

    expect(state.lastConfig).toEqual(config);
    expect(state.lastConfig).not.toBe(config);
  });

  it('stores config reference directly in lastConfig in frozen mode', () => {
    const config = { foo: 'bar' };
    const state = createStoreState(
      config,
      [],
      '/project/config.json',
      mockOptions,
      300,
      vi.fn(),
    );

    expect(state.lastConfig).toEqual(config);
    expect(state.lastConfig).toBe(config);
  });

  it('initializes remergeInProgress as false', () => {
    const state = createStoreState(
      {},
      [],
      '/project/config.json',
      mockOptions,
      300,
      vi.fn(),
    );

    expect(state.remergeInProgress).toBe(false);
  });

  it('initializes pendingRemerge as false', () => {
    const state = createStoreState(
      {},
      [],
      '/project/config.json',
      mockOptions,
      300,
      vi.fn(),
    );

    expect(state.pendingRemerge).toBe(false);
  });

  it('initializes inTransaction as false', () => {
    const state = createStoreState(
      {},
      [],
      '/project/config.json',
      mockOptions,
      300,
      vi.fn(),
    );

    expect(state.inTransaction).toBe(false);
    expect(state.transactionDirtyKeys).toEqual(new Map());
  });

  it('initializes remergeDone as undefined', () => {
    const state = createStoreState(
      {},
      [],
      '/project/config.json',
      mockOptions,
      300,
      vi.fn(),
    );

    expect(state.remergeDone).toBeUndefined();
  });
});

describe('deepClone', () => {
  beforeEach(() => {
    vi.mocked(isPlainObject).mockImplementation(
      (value) =>
        typeof value === 'object' &&
        value !== null &&
        Object.getPrototypeOf(value) === Object.prototype,
    );
  });

  it('clones plain objects recursively', () => {
    const input = { a: { b: { c: 1 } } };
    const clone = deepClone(input);

    expect(clone).toEqual(input);
    expect(clone).not.toBe(input);
    expect(clone['a']).not.toBe(input['a']);
    expect((clone['a'] as Record<string, unknown>)['b']).not.toBe(
      (input['a'] as Record<string, unknown>)['b'],
    );
  });

  it('clones arrays element by element', () => {
    const input = { items: [{ x: 1 }, { y: 2 }] };
    const clone = deepClone(input);

    expect(clone).toEqual(input);
    const cloneItems = clone['items'] as unknown[];
    const inputItems = input['items'] as unknown[];
    expect(cloneItems).not.toBe(inputItems);
    expect(cloneItems[0]).not.toBe(inputItems[0]);
    expect(cloneItems[1]).not.toBe(inputItems[1]);
  });

  it('returns primitives as-is', () => {
    expect(deepClone(42)).toBe(42);
    expect(deepClone('hello')).toBe('hello');
    expect(deepClone(true)).toBe(true);
    expect(deepClone(undefined)).toBe(undefined);
    expect(deepClone(null)).toBe(null);
  });

  it('clones empty objects', () => {
    const clone = deepClone({});

    expect(clone).toEqual({});
    expect(clone).not.toBe({});
  });

  it('clones empty arrays', () => {
    const clone = deepClone([]);

    expect(clone).toEqual([]);
  });

  it('clones nested arrays inside objects', () => {
    const input = {
      a: [
        [1, 2],
        [3, 4],
      ],
    };
    const clone = deepClone(input);

    expect(clone).toEqual(input);
    const cloneA = clone['a'] as unknown[][];
    const inputA = input['a'] as unknown[][];
    expect(cloneA).not.toBe(inputA);
    expect(cloneA[0]).not.toBe(inputA[0]);
  });

  it('clones objects inside arrays', () => {
    const input = [{ a: 1 }, { b: 2 }];
    const clone = deepClone(input);

    expect(clone).toEqual(input);
    expect(clone).not.toBe(input);
    expect(clone[0]).not.toBe(input[0]);
    expect(clone[1]).not.toBe(input[1]);
  });

  it('returns non-plain objects as-is when isPlainObject returns false', () => {
    vi.mocked(isPlainObject).mockReturnValue(false);
    class Custom {
      value = 42;
    }
    const custom = new Custom();

    const clone = deepClone(custom);

    expect(clone).toBe(custom);
  });

  it('handles mixed nested structures', () => {
    const input = {
      str: 'hello',
      num: 42,
      arr: [1, { nested: true }],
      obj: { deep: { value: 'x' } },
      nil: null,
    };
    const clone = deepClone(input);

    expect(clone).toEqual(input);
    expect(clone).not.toBe(input);
    expect(clone['arr']).not.toBe(input['arr']);
    expect(clone['obj']).not.toBe(input['obj']);
  });
});
