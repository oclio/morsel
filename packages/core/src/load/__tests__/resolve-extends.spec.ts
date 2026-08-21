import { checkCycleOrDepth } from '@/load/extends-core';
import { normalizeExtends, stripExtends } from '@/load/extends-helpers';
import { loadFile } from '@/load/load-file';
import { resolveEnv } from '@/load/resolve-env';
import { resolveExtends } from '@/load/resolve-extends';
import { deepMerge } from '@/merge/deep-merge';
import { jsonPlugin } from '@/plugins/json-plugin';

vi.mock('@/load/extends-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/load/extends-core')>();
  return {
    ...actual,
    checkCycleOrDepth: vi.fn(),
  };
});

vi.mock('@/load/extends-helpers', () => ({
  normalizeExtends: vi.fn(),
  stripExtends: vi.fn(),
}));

vi.mock('@/load/load-file', () => ({
  loadFile: vi.fn(),
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

describe('resolveExtends', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when checkCycleOrDepth detects a cycle', async () => {
    vi.mocked(checkCycleOrDepth).mockImplementation(() => {
      throw new Error('ECYCLE');
    });

    await expect(resolveExtends('/fake/cycle.json', options)).rejects.toThrow(
      'ECYCLE',
    );
    expect(loadFile).not.toHaveBeenCalled();
  });

  it('returns empty config with extendsPaths when file does not exist', async () => {
    vi.mocked(checkCycleOrDepth).mockReturnValue(undefined);
    vi.mocked(loadFile).mockResolvedValue({
      exists: false,
      config: {},
    });

    const result = await resolveExtends('/fake/missing.json', options);

    expect(result.exists).toBe(false);
    expect(result.config).toEqual({});
    expect(result.extendsPaths).toHaveLength(0);
  });

  it('returns own config when no extends is present', async () => {
    vi.mocked(checkCycleOrDepth).mockReturnValue(undefined);
    vi.mocked(loadFile).mockResolvedValue({
      exists: true,
      config: { foo: 'bar' },
    });
    vi.mocked(resolveEnv).mockReturnValue({ foo: 'bar' });
    vi.mocked(stripExtends).mockReturnValue({ foo: 'bar' });

    const result = await resolveExtends('/fake/config.json', options);

    expect(result.exists).toBe(true);
    expect(result.config).toEqual({ foo: 'bar' });
    expect(result.extendsPaths).toHaveLength(0);
    expect(deepMerge).not.toHaveBeenCalled();
  });

  it('merges parent configs when extends is present', async () => {
    vi.mocked(checkCycleOrDepth).mockReturnValue(undefined);
    vi.mocked(loadFile)
      .mockResolvedValueOnce({
        exists: true,
        config: { extends: './parent.json', foo: 'child' },
      })
      .mockResolvedValueOnce({ exists: true, config: { bar: 'parent' } });
    vi.mocked(resolveEnv)
      .mockReturnValueOnce({
        extends: './parent.json',
        foo: 'child',
      })
      .mockReturnValueOnce({ bar: 'parent' });
    vi.mocked(stripExtends)
      .mockReturnValueOnce({ foo: 'child' })
      .mockReturnValueOnce({ bar: 'parent' });
    vi.mocked(normalizeExtends).mockReturnValue(['/fake/parent.json']);
    vi.mocked(checkCycleOrDepth)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(undefined);

    const result = await resolveExtends('/fake/child.json', options);

    expect(result.exists).toBe(true);
    expect(result.config).toEqual({ bar: 'parent', foo: 'child' });
    expect(result.extendsPaths).toHaveLength(1);
  });

  it('deduplicates extendsPaths', async () => {
    vi.mocked(checkCycleOrDepth).mockReturnValue(undefined);
    vi.mocked(loadFile)
      .mockResolvedValueOnce({
        exists: true,
        config: { extends: ['./a.json', './a.json'] },
      })
      .mockResolvedValueOnce({ exists: true, config: {} })
      .mockResolvedValueOnce({ exists: true, config: {} });
    vi.mocked(resolveEnv)
      .mockReturnValueOnce({ extends: ['./a.json', './a.json'] })
      .mockReturnValueOnce({})
      .mockReturnValueOnce({});
    vi.mocked(stripExtends)
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({});
    vi.mocked(normalizeExtends).mockReturnValue([
      '/fake/a.json',
      '/fake/a.json',
    ]);
    vi.mocked(checkCycleOrDepth)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(undefined);

    const result = await resolveExtends('/fake/config.json', options);

    const uniquePaths = [...new Set(result.extendsPaths)];
    expect(result.extendsPaths).toHaveLength(uniquePaths.length);
  });

  it('handles parent file that does not exist', async () => {
    vi.mocked(checkCycleOrDepth).mockReturnValue(undefined);
    vi.mocked(loadFile)
      .mockResolvedValueOnce({
        exists: true,
        config: { extends: './missing.json', foo: 'child' },
      })
      .mockResolvedValueOnce({ exists: false, config: {} });
    vi.mocked(resolveEnv)
      .mockReturnValueOnce({
        extends: './missing.json',
        foo: 'child',
      })
      .mockReturnValueOnce({});
    vi.mocked(stripExtends)
      .mockReturnValueOnce({ foo: 'child' })
      .mockReturnValueOnce({});
    vi.mocked(normalizeExtends).mockReturnValue(['/fake/missing.json']);
    vi.mocked(checkCycleOrDepth)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(undefined);

    const result = await resolveExtends('/fake/child.json', options);

    expect(result.exists).toBe(true);
    expect(result.config).toEqual({ foo: 'child' });
  });

  it('passes resolved path to checkCycleOrDepth', async () => {
    vi.mocked(checkCycleOrDepth).mockReturnValue(undefined);
    vi.mocked(loadFile).mockResolvedValue({
      exists: true,
      config: { foo: 'bar' },
    });
    vi.mocked(resolveEnv).mockReturnValue({ foo: 'bar' });
    vi.mocked(stripExtends).mockReturnValue({ foo: 'bar' });

    await resolveExtends('/fake/config.json', options);

    expect(checkCycleOrDepth).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Set),
      0,
    );
  });

  it('passes options to resolveEnv', async () => {
    vi.mocked(checkCycleOrDepth).mockReturnValue(undefined);
    vi.mocked(loadFile).mockResolvedValue({
      exists: true,
      config: { foo: 'bar' },
    });
    vi.mocked(resolveEnv).mockReturnValue({ foo: 'bar' });
    vi.mocked(stripExtends).mockReturnValue({ foo: 'bar' });

    await resolveExtends('/fake/config.json', options);

    expect(resolveEnv).toHaveBeenCalledWith({ foo: 'bar' }, options);
  });

  it('passes dirname to normalizeExtends', async () => {
    vi.mocked(checkCycleOrDepth).mockReturnValue(undefined);
    vi.mocked(loadFile)
      .mockResolvedValueOnce({
        exists: true,
        config: { extends: './parent.json' },
      })
      .mockResolvedValueOnce({ exists: true, config: {} });
    vi.mocked(resolveEnv)
      .mockReturnValueOnce({ extends: './parent.json' })
      .mockReturnValueOnce({});
    vi.mocked(stripExtends).mockReturnValueOnce({}).mockReturnValueOnce({});
    vi.mocked(normalizeExtends).mockReturnValue(['/fake/parent.json']);
    vi.mocked(checkCycleOrDepth)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(undefined);

    await resolveExtends('/fake/child.json', options);

    expect(normalizeExtends).toHaveBeenCalledWith(
      './parent.json',
      expect.stringContaining('/fake'),
    );
  });

  it('uses replace strategy for deepMerge', async () => {
    vi.mocked(checkCycleOrDepth).mockReturnValue(undefined);
    vi.mocked(loadFile)
      .mockResolvedValueOnce({
        exists: true,
        config: { extends: './parent.json', foo: 'child' },
      })
      .mockResolvedValueOnce({ exists: true, config: { bar: 'parent' } });
    vi.mocked(resolveEnv)
      .mockReturnValueOnce({
        extends: './parent.json',
        foo: 'child',
      })
      .mockReturnValueOnce({ bar: 'parent' });
    vi.mocked(stripExtends)
      .mockReturnValueOnce({ foo: 'child' })
      .mockReturnValueOnce({ bar: 'parent' });
    vi.mocked(normalizeExtends).mockReturnValue(['/fake/parent.json']);
    vi.mocked(checkCycleOrDepth)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(undefined);

    await resolveExtends('/fake/child.json', options);

    expect(deepMerge).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      'replace',
    );
  });

  it('throws when loadFile throws a parse error (EPARSE must propagate)', async () => {
    vi.mocked(checkCycleOrDepth).mockReturnValue(undefined);
    vi.mocked(loadFile).mockRejectedValue(new Error('EPARSE'));

    await expect(resolveExtends('/fake/broken.json', options)).rejects.toThrow(
      'EPARSE',
    );
  });

  it('throws when a parent extends file has a parse error', async () => {
    vi.mocked(checkCycleOrDepth).mockReturnValue(undefined);
    vi.mocked(loadFile)
      .mockResolvedValueOnce({
        exists: true,
        config: { extends: './broken.json', foo: 'child' },
      })
      .mockRejectedValueOnce(new Error('EPARSE'));
    vi.mocked(resolveEnv).mockReturnValue({
      extends: './broken.json',
      foo: 'child',
    });
    vi.mocked(stripExtends).mockReturnValue({ foo: 'child' });
    vi.mocked(normalizeExtends).mockReturnValue(['/fake/broken.json']);
    vi.mocked(checkCycleOrDepth)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(undefined);

    await expect(resolveExtends('/fake/child.json', options)).rejects.toThrow(
      'EPARSE',
    );
  });
});
