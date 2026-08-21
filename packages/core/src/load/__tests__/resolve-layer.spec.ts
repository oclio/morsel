import { stripExtends } from '@/load/extends-helpers';
import { buildFileLayer, buildRawLayer } from '@/load/layer-helpers';
import { resolveEnv } from '@/load/resolve-env';
import { resolveExtends } from '@/load/resolve-extends';
import { resolveLayer } from '@/load/resolve-layer';
import { jsonPlugin } from '@/plugins/json-plugin';

vi.mock('@/load/extends-helpers', () => ({
  stripExtends: vi.fn(),
}));

vi.mock('@/load/layer-helpers', () => ({
  buildFileLayer: vi.fn(),
  buildRawLayer: vi.fn(),
}));

vi.mock('@/load/resolve-env', () => ({
  resolveEnv: vi.fn(),
}));

vi.mock('@/load/resolve-extends', () => ({
  resolveExtends: vi.fn(),
}));

const options = {
  envName: undefined,
  onDebug: undefined,
  formatPlugins: [jsonPlugin],
};

describe('resolveLayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    {
      name: 'defaults',
      source: 'defaults' as const,
      rawConfig: { foo: 'bar' },
    },
    {
      name: 'overrides',
      source: 'overrides' as const,
      rawConfig: { baz: 'qux' },
    },
  ])(
    'resolves raw layer for $name source with rawConfig',
    async ({ source, rawConfig }) => {
      vi.mocked(resolveEnv).mockReturnValue(rawConfig);
      vi.mocked(stripExtends).mockReturnValue(rawConfig);
      vi.mocked(buildRawLayer).mockReturnValue({
        source,
        path: undefined,
        exists: true,
        config: rawConfig,
        extendsPaths: [],
      });

      const result = await resolveLayer(source, undefined, rawConfig, options);

      expect(resolveEnv).toHaveBeenCalledWith(rawConfig, options);
      expect(stripExtends).toHaveBeenCalledWith(rawConfig);
      expect(buildRawLayer).toHaveBeenCalledWith(source, rawConfig);
      expect(result.source).toBe(source);
    },
  );

  it('uses empty object when rawConfig is undefined for raw layer', async () => {
    vi.mocked(resolveEnv).mockReturnValue({});
    vi.mocked(stripExtends).mockReturnValue({});
    vi.mocked(buildRawLayer).mockReturnValue({
      source: 'defaults',
      path: undefined,
      exists: true,
      config: {},
      extendsPaths: [],
    });

    await resolveLayer('defaults', undefined, undefined, options);

    expect(resolveEnv).toHaveBeenCalledWith({}, options);
  });

  it.each([
    {
      name: 'global',
      source: 'global' as const,
      filePath: '/fake/global.json',
      config: { foo: 'bar' },
    },
    {
      name: 'project',
      source: 'project' as const,
      filePath: '/fake/project.json',
      config: { port: 3000 },
    },
  ])(
    'resolves file layer for $name source with filePath',
    async ({ source, filePath, config }) => {
      const extendsResult = {
        exists: true,
        config,
        extendsPaths: [filePath],
      };
      vi.mocked(resolveExtends).mockResolvedValue(extendsResult);
      vi.mocked(buildFileLayer).mockReturnValue({
        source,
        path: filePath,
        exists: true,
        config,
        extendsPaths: [filePath],
      });

      const result = await resolveLayer(source, filePath, undefined, options);

      expect(resolveExtends).toHaveBeenCalledWith(filePath, options);
      expect(buildFileLayer).toHaveBeenCalledWith(
        source,
        filePath,
        extendsResult,
      );
      expect(result.source).toBe(source);
    },
  );

  it('does not call resolveEnv when filePath is provided', async () => {
    vi.mocked(resolveExtends).mockResolvedValue({
      exists: true,
      config: {},
      extendsPaths: [],
    });
    vi.mocked(buildFileLayer).mockReturnValue({
      source: 'global',
      path: '/fake/global.json',
      exists: true,
      config: {},
      extendsPaths: [],
    });

    await resolveLayer('global', '/fake/global.json', undefined, options);

    expect(resolveEnv).not.toHaveBeenCalled();
  });

  it('does not call resolveExtends when filePath is undefined', async () => {
    vi.mocked(resolveEnv).mockReturnValue({});
    vi.mocked(stripExtends).mockReturnValue({});
    vi.mocked(buildRawLayer).mockReturnValue({
      source: 'defaults',
      path: undefined,
      exists: true,
      config: {},
      extendsPaths: [],
    });

    await resolveLayer('defaults', undefined, {}, options);

    expect(resolveExtends).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'global', source: 'global' as const },
    { name: 'project', source: 'project' as const },
  ])(
    'returns exists:false for $name source when filePath is undefined',
    async ({ source }) => {
      const result = await resolveLayer(source, undefined, undefined, options);

      expect(result).toEqual({
        source,
        path: undefined,
        exists: false,
        config: {},
        extendsPaths: [],
      });
      expect(buildRawLayer).not.toHaveBeenCalled();
      expect(resolveEnv).not.toHaveBeenCalled();
      expect(stripExtends).not.toHaveBeenCalled();
      expect(resolveExtends).not.toHaveBeenCalled();
    },
  );
});
