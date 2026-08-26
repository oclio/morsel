import { createHookContext } from '@/hooks/hook-context';
import { runHooks } from '@/hooks/run-hooks';
import { buildLayers } from '@/load/build-layers';
import type { ResolvedLayer } from '@/load/resolve-layer';
import { resolveLayer } from '@/load/resolve-layer';
import { jsonPlugin } from '@/plugins/json-plugin';
import type { ResolvedOptions } from '@/store/boot/assert-name';

vi.mock('@/hooks/hook-context', () => ({
  createHookContext: vi
    .fn()
    .mockReturnValue({ cwd: '/project', envName: 'test' }),
}));
vi.mock('@/hooks/run-hooks', () => ({
  runHooks: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/load/resolve-layer', () => ({
  resolveLayer: vi.fn(),
}));

function makeResolvedLayer(
  overrides: Partial<ResolvedLayer> = {},
): ResolvedLayer {
  return {
    source: 'defaults',
    path: undefined,
    config: {},
    exists: true,
    extendsPaths: [],
    ...overrides,
  };
}

function makeResolvedOptions(
  overrides: Partial<ResolvedOptions> = {},
): ResolvedOptions {
  return {
    name: 'myapp',
    cwd: '/project',
    defaults: { default: true },
    overrides: { override: true },
    globalDir: '/global',
    arrayMerge: 'replace',
    envName: 'test',
    configMutability: 'frozen',
    verbose: false,
    onDebug: () => {},
    formatPlugins: [jsonPlugin],
    validationPlugins: [],
    hooks: [],
    watch: true,
    proxy: true,
    queue: true,
    ...overrides,
  } as never;
}

describe('buildLayers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveLayer).mockResolvedValue(makeResolvedLayer());
  });

  it('resolves four layers in order with correct source strings', async () => {
    const resolved = makeResolvedOptions();

    await buildLayers(
      resolved,
      '/global/myapp.config.json',
      '/project/myapp.config.json',
    );

    expect(resolveLayer).toHaveBeenNthCalledWith(
      1,
      'defaults',
      undefined,
      { default: true },
      expect.objectContaining({
        envName: 'test',
        onDebug: expect.any(Function),
      }),
    );
    expect(resolveLayer).toHaveBeenNthCalledWith(
      2,
      'global',
      '/global/myapp.config.json',
      undefined,
      expect.objectContaining({
        envName: 'test',
        onDebug: expect.any(Function),
      }),
    );
    expect(resolveLayer).toHaveBeenNthCalledWith(
      3,
      'project',
      '/project/myapp.config.json',
      undefined,
      expect.objectContaining({
        envName: 'test',
        onDebug: expect.any(Function),
      }),
    );
    expect(resolveLayer).toHaveBeenNthCalledWith(
      4,
      'overrides',
      undefined,
      { override: true },
      expect.objectContaining({
        envName: 'test',
        onDebug: expect.any(Function),
      }),
    );
  });

  it('calls runHooks with all 8 lifecycle points in order', async () => {
    const resolved = makeResolvedOptions();

    await buildLayers(resolved, undefined, undefined);

    const calls = vi.mocked(runHooks).mock.calls;
    const lifecycles = calls.map((call) => call[1]);
    expect(lifecycles).toEqual([
      'before:defaults',
      'after:defaults',
      'before:global',
      'after:global',
      'before:project',
      'after:project',
      'before:overrides',
      'after:overrides',
    ]);
  });

  it('creates hook context from resolved options', async () => {
    const resolved = makeResolvedOptions();

    await buildLayers(resolved, undefined, undefined);

    expect(createHookContext).toHaveBeenCalledWith(
      resolved,
      expect.any(Function),
    );
  });

  it('passes hooks from resolved options to runHooks', async () => {
    const hook = {
      name: 'env',
      lifecycle: 'before:defaults',
      load: () => ({}),
    };
    const resolved = makeResolvedOptions({ hooks: [hook] as never });

    await buildLayers(resolved, undefined, undefined);

    expect(runHooks).toHaveBeenCalledWith(
      [hook],
      'before:defaults',
      expect.any(Object),
      expect.any(Function),
    );
  });

  it('passes formatPlugins in layer options to resolveLayer', async () => {
    const resolved = makeResolvedOptions();

    await buildLayers(resolved, undefined, undefined);

    expect(resolveLayer).toHaveBeenNthCalledWith(
      1,
      'defaults',
      undefined,
      { default: true },
      expect.objectContaining({
        formatPlugins: [jsonPlugin],
      }),
    );
  });

  it('returns interleaved hook and resolved layers', async () => {
    const hookLayer = makeResolvedLayer({
      source: 'defaults',
      config: { hook: true },
    });
    vi.mocked(runHooks).mockResolvedValueOnce([hookLayer]);
    const resolved = makeResolvedOptions();

    const result = await buildLayers(resolved, undefined, undefined);

    expect(result[0]).toBe(hookLayer);
    expect(result[1]).toEqual(expect.objectContaining({ source: 'defaults' }));
  });

  it('handles undefined global and project paths', async () => {
    const resolved = makeResolvedOptions();

    await buildLayers(resolved, undefined, undefined);

    expect(resolveLayer).toHaveBeenNthCalledWith(
      2,
      'global',
      undefined,
      undefined,
      expect.objectContaining({ envName: 'test' }),
    );
    expect(resolveLayer).toHaveBeenNthCalledWith(
      3,
      'project',
      undefined,
      undefined,
      expect.objectContaining({ envName: 'test' }),
    );
  });
});
