import { checkCycleOrDepth } from '@/load/extends/extends-core';
import { normalizeExtends, stripExtends } from '@/load/extends/extends-helpers';
import { resolveExtendsSync } from '@/load/extends/resolve-extends-sync';
import { loadFileSync } from '@/load/load-file';
import { resolveEnv } from '@/load/resolve-env';
import { deepMerge } from '@/merge/deep-merge';
import { jsonPlugin } from '@/plugins/json-plugin';

vi.mock('@/load/extends/extends-core', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/load/extends/extends-core')>();
  return {
    ...actual,
    checkCycleOrDepth: vi.fn(),
  };
});

vi.mock('@/load/extends/extends-helpers', () => ({
  normalizeExtends: vi.fn(),
  stripExtends: vi.fn(),
}));

vi.mock('@/load/load-file', () => ({
  loadFileSync: vi.fn(),
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

const options = {
  envName: undefined,
  onDebug: undefined,
  formatPlugins: [jsonPlugin],
};

describe('resolveExtendsSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when checkCycleOrDepth detects a cycle', () => {
    vi.mocked(checkCycleOrDepth).mockImplementation(() => {
      throw new Error('ECYCLE');
    });

    expect(() => resolveExtendsSync('/fake/cycle.json', options)).toThrow(
      'ECYCLE',
    );
    expect(loadFileSync).not.toHaveBeenCalled();
  });

  it('returns empty config with extendsPaths when file does not exist', () => {
    vi.mocked(checkCycleOrDepth).mockReturnValue(undefined);
    vi.mocked(loadFileSync).mockReturnValue({
      exists: false,
      config: {},
    });

    const result = resolveExtendsSync('/fake/missing.json', options);

    expect(result.exists).toBe(false);
    expect(result.config).toEqual({});
    expect(result.extendsPaths).toHaveLength(0);
  });

  it('returns own config when no extends is present', () => {
    vi.mocked(checkCycleOrDepth).mockReturnValue(undefined);
    vi.mocked(loadFileSync).mockReturnValue({
      exists: true,
      config: { foo: 'bar' },
    });
    vi.mocked(resolveEnv).mockReturnValue({ foo: 'bar' });
    vi.mocked(stripExtends).mockReturnValue({ foo: 'bar' });

    const result = resolveExtendsSync('/fake/config.json', options);

    expect(result.exists).toBe(true);
    expect(result.config).toEqual({ foo: 'bar' });
    expect(result.extendsPaths).toHaveLength(0);
    expect(deepMerge).not.toHaveBeenCalled();
  });

  it('merges parent configs when extends is present', () => {
    vi.mocked(checkCycleOrDepth).mockReturnValue(undefined);
    vi.mocked(loadFileSync).mockReturnValue({
      exists: true,
      config: { extends: './parent.json', foo: 'child' },
    });
    vi.mocked(resolveEnv).mockReturnValue({
      extends: './parent.json',
      foo: 'child',
    });
    vi.mocked(stripExtends).mockReturnValue({ foo: 'child' });
    vi.mocked(normalizeExtends).mockReturnValue(['/fake/parent.json']);

    const parentLoadResult = {
      exists: true as const,
      config: { bar: 'parent' },
    };
    const parentEnvironmentResult = { bar: 'parent' };
    const parentStripped = { bar: 'parent' };

    vi.mocked(loadFileSync)
      .mockReturnValueOnce({
        exists: true,
        config: { extends: './parent.json', foo: 'child' },
      })
      .mockReturnValueOnce(parentLoadResult);
    vi.mocked(resolveEnv)
      .mockReturnValueOnce({
        extends: './parent.json',
        foo: 'child',
      })
      .mockReturnValueOnce(parentEnvironmentResult);
    vi.mocked(stripExtends)
      .mockReturnValueOnce({ foo: 'child' })
      .mockReturnValueOnce(parentStripped);
    vi.mocked(checkCycleOrDepth)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(undefined);

    const result = resolveExtendsSync('/fake/child.json', options);

    expect(result.exists).toBe(true);
    expect(result.config).toEqual({ bar: 'parent', foo: 'child' });
    expect(result.extendsPaths).toHaveLength(1);
  });

  it('deduplicates extendsPaths', () => {
    vi.mocked(checkCycleOrDepth).mockReturnValue(undefined);
    vi.mocked(loadFileSync).mockReturnValue({
      exists: true,
      config: { extends: ['./a.json', './a.json'] },
    });
    vi.mocked(resolveEnv).mockReturnValue({
      extends: ['./a.json', './a.json'],
    });
    vi.mocked(stripExtends).mockReturnValue({});
    vi.mocked(normalizeExtends).mockReturnValue([
      '/fake/a.json',
      '/fake/a.json',
    ]);

    vi.mocked(loadFileSync)
      .mockReturnValueOnce({
        exists: true,
        config: { extends: ['./a.json', './a.json'] },
      })
      .mockReturnValueOnce({ exists: true, config: {} })
      .mockReturnValueOnce({ exists: true, config: {} });
    vi.mocked(resolveEnv)
      .mockReturnValueOnce({ extends: ['./a.json', './a.json'] })
      .mockReturnValueOnce({})
      .mockReturnValueOnce({});
    vi.mocked(stripExtends)
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({});
    vi.mocked(checkCycleOrDepth)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(undefined);

    const result = resolveExtendsSync('/fake/config.json', options);

    const uniquePaths = [...new Set(result.extendsPaths)];
    expect(result.extendsPaths).toHaveLength(uniquePaths.length);
  });

  it('handles parent file that does not exist', () => {
    vi.mocked(checkCycleOrDepth).mockReturnValue(undefined);
    vi.mocked(loadFileSync).mockReturnValue({
      exists: true,
      config: { extends: './missing.json', foo: 'child' },
    });
    vi.mocked(resolveEnv).mockReturnValue({
      extends: './missing.json',
      foo: 'child',
    });
    vi.mocked(stripExtends).mockReturnValue({ foo: 'child' });
    vi.mocked(normalizeExtends).mockReturnValue(['/fake/missing.json']);

    vi.mocked(loadFileSync)
      .mockReturnValueOnce({
        exists: true,
        config: { extends: './missing.json', foo: 'child' },
      })
      .mockReturnValueOnce({ exists: false, config: {} });
    vi.mocked(resolveEnv)
      .mockReturnValueOnce({
        extends: './missing.json',
        foo: 'child',
      })
      .mockReturnValueOnce({});
    vi.mocked(stripExtends)
      .mockReturnValueOnce({ foo: 'child' })
      .mockReturnValueOnce({});
    vi.mocked(checkCycleOrDepth)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(undefined);

    const result = resolveExtendsSync('/fake/child.json', options);

    expect(result.exists).toBe(true);
    expect(result.config).toEqual({ foo: 'child' });
  });

  it('passes resolved path to checkCycleOrDepth', () => {
    vi.mocked(checkCycleOrDepth).mockReturnValue(undefined);
    vi.mocked(loadFileSync).mockReturnValue({
      exists: true,
      config: { foo: 'bar' },
    });
    vi.mocked(resolveEnv).mockReturnValue({ foo: 'bar' });
    vi.mocked(stripExtends).mockReturnValue({ foo: 'bar' });

    resolveExtendsSync('/fake/config.json', options);

    expect(checkCycleOrDepth).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Set),
      0,
    );
  });

  it('passes options to resolveEnv', () => {
    vi.mocked(checkCycleOrDepth).mockReturnValue(undefined);
    vi.mocked(loadFileSync).mockReturnValue({
      exists: true,
      config: { foo: 'bar' },
    });
    vi.mocked(resolveEnv).mockReturnValue({ foo: 'bar' });
    vi.mocked(stripExtends).mockReturnValue({ foo: 'bar' });

    resolveExtendsSync('/fake/config.json', options);

    expect(resolveEnv).toHaveBeenCalledWith({ foo: 'bar' }, options);
  });

  it('passes dirname to normalizeExtends', () => {
    vi.mocked(checkCycleOrDepth).mockReturnValue(undefined);
    vi.mocked(loadFileSync).mockReturnValue({
      exists: true,
      config: { extends: './parent.json' },
    });
    vi.mocked(resolveEnv).mockReturnValue({ extends: './parent.json' });
    vi.mocked(stripExtends).mockReturnValue({});
    vi.mocked(normalizeExtends).mockReturnValue(['/fake/parent.json']);

    vi.mocked(loadFileSync)
      .mockReturnValueOnce({
        exists: true,
        config: { extends: './parent.json' },
      })
      .mockReturnValueOnce({ exists: true, config: {} });
    vi.mocked(resolveEnv)
      .mockReturnValueOnce({ extends: './parent.json' })
      .mockReturnValueOnce({});
    vi.mocked(stripExtends).mockReturnValueOnce({}).mockReturnValueOnce({});
    vi.mocked(checkCycleOrDepth)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(undefined);

    resolveExtendsSync('/fake/child.json', options);

    expect(normalizeExtends).toHaveBeenCalledWith(
      './parent.json',
      expect.stringContaining('/fake'),
    );
  });

  it('uses replace strategy for deepMerge', () => {
    vi.mocked(checkCycleOrDepth).mockReturnValue(undefined);
    vi.mocked(loadFileSync).mockReturnValue({
      exists: true,
      config: { extends: './parent.json', foo: 'child' },
    });
    vi.mocked(resolveEnv).mockReturnValue({
      extends: './parent.json',
      foo: 'child',
    });
    vi.mocked(stripExtends).mockReturnValue({ foo: 'child' });
    vi.mocked(normalizeExtends).mockReturnValue(['/fake/parent.json']);

    vi.mocked(loadFileSync)
      .mockReturnValueOnce({
        exists: true,
        config: { extends: './parent.json', foo: 'child' },
      })
      .mockReturnValueOnce({ exists: true, config: { bar: 'parent' } });
    vi.mocked(resolveEnv)
      .mockReturnValueOnce({
        extends: './parent.json',
        foo: 'child',
      })
      .mockReturnValueOnce({ bar: 'parent' });
    vi.mocked(stripExtends)
      .mockReturnValueOnce({ foo: 'child' })
      .mockReturnValueOnce({ bar: 'parent' });
    vi.mocked(checkCycleOrDepth)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(undefined);

    resolveExtendsSync('/fake/child.json', options);

    expect(deepMerge).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      'replace',
    );
  });

  it('throws when loadFileSync throws a parse error (EPARSE must propagate)', () => {
    vi.mocked(checkCycleOrDepth).mockReturnValue(undefined);
    vi.mocked(loadFileSync).mockImplementation(() => {
      throw new Error('EPARSE');
    });

    expect(() => resolveExtendsSync('/fake/broken.json', options)).toThrow(
      'EPARSE',
    );
  });

  it('throws when a parent extends file has a parse error', () => {
    vi.mocked(checkCycleOrDepth).mockReturnValue(undefined);
    vi.mocked(loadFileSync)
      .mockReturnValueOnce({
        exists: true,
        config: { extends: './broken.json', foo: 'child' },
      })
      .mockImplementationOnce(() => {
        throw new Error('EPARSE');
      });
    vi.mocked(resolveEnv).mockReturnValue({
      extends: './broken.json',
      foo: 'child',
    });
    vi.mocked(stripExtends).mockReturnValue({ foo: 'child' });
    vi.mocked(normalizeExtends).mockReturnValue(['/fake/broken.json']);
    vi.mocked(checkCycleOrDepth)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(undefined);

    expect(() => resolveExtendsSync('/fake/child.json', options)).toThrow(
      'EPARSE',
    );
  });
});
