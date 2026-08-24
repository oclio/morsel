import path from 'node:path';

import { MorselError } from '@/errors/error';
import {
  checkCycleOrDepth,
  mergeExtendsResults,
  processLoadedFile,
  type ResolveExtendsOptions,
} from '@/load/extends-core';
import { normalizeExtends, stripExtends } from '@/load/extends-helpers';
import { resolveEnv } from '@/load/resolve-env';
import { deepMerge } from '@/merge/deep-merge';
import { jsonPlugin } from '@/plugins/json-plugin';

vi.mock('@/load/extends-helpers', () => ({
  normalizeExtends: vi.fn(),
  stripExtends: vi.fn(),
}));

vi.mock('@/load/resolve-env', () => ({
  resolveEnv: vi.fn(),
}));

vi.mock('@/merge/deep-merge', () => ({
  deepMerge: vi.fn(
    (base: Record<string, unknown>, override: Record<string, unknown>) => ({
      ...base,
      ...override,
    }),
  ),
}));

const options: ResolveExtendsOptions = {
  envName: undefined,
  onDebug: undefined,
  formatPlugins: [jsonPlugin],
};

describe('checkCycleOrDepth', () => {
  it.each([
    {
      name: 'returns undefined when path not visited and depth under limit',
      visited: new Set<string>(),
      depth: 0,
    },
    {
      name: 'returns undefined when path not visited and depth at 9',
      visited: new Set<string>(),
      depth: 9,
    },
  ])('$name', ({ visited, depth }) => {
    const result = checkCycleOrDepth('/fake/config.json', visited, depth);

    expect(result).toBeUndefined();
  });

  it.each([
    {
      name: 'throws ECYCLE when path already visited (cycle)',
      visited: new Set(['/fake/config.json']),
      depth: 0,
    },
    {
      name: 'throws ECYCLE when depth reaches limit (10)',
      visited: new Set<string>(),
      depth: 10,
    },
    {
      name: 'throws ECYCLE when both cycle and depth exceeded',
      visited: new Set(['/fake/config.json']),
      depth: 15,
    },
  ])('$name', ({ visited, depth }) => {
    expect(() =>
      checkCycleOrDepth('/fake/config.json', visited, depth),
    ).toThrow(MorselError);

    try {
      checkCycleOrDepth('/fake/config.json', visited, depth);
    } catch (error) {
      expect(error).toBeInstanceOf(MorselError);
      expect((error as MorselError).code).toBe('ECYCLE');
      expect((error as MorselError).path).toBe('/fake/config.json');
      expect((error as MorselError).cause.message).toBe(
        'extends cycle or depth limit (10) reached at /fake/config.json',
      );
    }
  });

  it('does not log to stderr when throwing (one-shot propagates)', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      checkCycleOrDepth('/fake/cycle.json', new Set(['/fake/cycle.json']), 0),
    ).toThrow();

    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('processLoadedFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns needsRecursion:false with empty result when file does not exist', () => {
    const processed = processLoadedFile(
      '/fake/missing.json',
      {
        exists: false,
        config: {},
      },
      options,
    );

    expect(processed.needsRecursion).toBe(false);
    if (!processed.needsRecursion) {
      expect(processed.result.exists).toBe(false);
      expect(processed.result.config).toEqual({});
      expect(processed.result.extendsPaths).toHaveLength(0);
    }
    expect(resolveEnv).not.toHaveBeenCalled();
  });

  it('returns needsRecursion:false with own config when no extends is present', () => {
    vi.mocked(resolveEnv).mockReturnValue({ foo: 'bar' });
    vi.mocked(stripExtends).mockReturnValue({ foo: 'bar' });

    const processed = processLoadedFile(
      '/fake/config.json',
      {
        exists: true,
        config: { foo: 'bar' },
      },
      options,
    );

    expect(processed.needsRecursion).toBe(false);
    if (!processed.needsRecursion) {
      expect(processed.result.exists).toBe(true);
      expect(processed.result.config).toEqual({ foo: 'bar' });
      expect(processed.result.extendsPaths).toHaveLength(0);
    }
    expect(normalizeExtends).not.toHaveBeenCalled();
  });

  it('returns needsRecursion:true with parentPaths and ownConfig when extends is present', () => {
    vi.mocked(resolveEnv).mockReturnValue({
      extends: './parent.json',
      foo: 'child',
    });
    vi.mocked(stripExtends).mockReturnValue({ foo: 'child' });
    vi.mocked(normalizeExtends).mockReturnValue(['/fake/parent.json']);

    const processed = processLoadedFile(
      '/fake/child.json',
      {
        exists: true,
        config: { extends: './parent.json', foo: 'child' },
      },
      options,
    );

    expect(processed.needsRecursion).toBe(true);
    if (processed.needsRecursion) {
      expect(processed.parentPaths).toEqual(['/fake/parent.json']);
      expect(processed.ownConfig).toEqual({ foo: 'child' });
    }
  });

  it('passes rawConfig and options to resolveEnv', () => {
    vi.mocked(resolveEnv).mockReturnValue({ foo: 'bar' });
    vi.mocked(stripExtends).mockReturnValue({ foo: 'bar' });

    processLoadedFile(
      '/fake/config.json',
      {
        exists: true,
        config: { foo: 'bar' },
      },
      options,
    );

    expect(resolveEnv).toHaveBeenCalledWith({ foo: 'bar' }, options);
  });

  it('passes extendsValue and dirname to normalizeExtends', () => {
    vi.mocked(resolveEnv).mockReturnValue({ extends: './parent.json' });
    vi.mocked(stripExtends).mockReturnValue({});
    vi.mocked(normalizeExtends).mockReturnValue(['/fake/parent.json']);

    processLoadedFile(
      '/fake/child.json',
      {
        exists: true,
        config: { extends: './parent.json' },
      },
      options,
    );

    expect(normalizeExtends).toHaveBeenCalledWith(
      './parent.json',
      path.dirname('/fake/child.json'),
    );
  });
});

describe('mergeExtendsResults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('merges parent configs left-to-right with replace strategy', () => {
    mergeExtendsResults(
      { foo: 'child' },
      ['/fake/parent.json'],
      [{ exists: true, config: { bar: 'parent' }, extendsPaths: [] }],
    );

    expect(deepMerge).toHaveBeenCalledWith({}, { bar: 'parent' }, 'replace');
  });

  it('merges own config on top of parents with replace strategy', () => {
    vi.mocked(deepMerge).mockReturnValueOnce({ bar: 'parent' });

    mergeExtendsResults(
      { foo: 'child' },
      ['/fake/parent.json'],
      [{ exists: true, config: { bar: 'parent' }, extendsPaths: [] }],
    );

    expect(deepMerge).toHaveBeenCalledWith(
      { bar: 'parent' },
      { foo: 'child' },
      'replace',
    );
  });

  it('collects extendsPaths from parents and resolved parentPaths, deduplicated', () => {
    const result = mergeExtendsResults(
      {},
      ['/fake/a.json', '/fake/a.json'],
      [
        { exists: true, config: {}, extendsPaths: ['/fake/sub.json'] },
        { exists: true, config: {}, extendsPaths: ['/fake/sub.json'] },
      ],
    );

    expect(result.exists).toBe(true);
    expect(result.extendsPaths).toEqual([
      '/fake/sub.json',
      path.resolve('/fake/a.json'),
    ]);
  });
});
