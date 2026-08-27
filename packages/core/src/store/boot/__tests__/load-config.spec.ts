import { createMockLayer } from '@oclio/test-helpers';

import { runHooks, runHooksSync } from '@/hooks/run-hooks';
import { applyMutability, mergeLayers } from '@/load/merge-layers';
import type { ResolvedLayer } from '@/load/resolve-layer';
import { resolveLayer } from '@/load/resolve-layer';
import { resolveLayerSync } from '@/load/resolve-layer-sync';
import {
  resolveGlobalPath,
  resolveGlobalPathSync,
  resolveProjectPath,
  resolveProjectPathSync,
} from '@/paths/resolve-paths';
import { jsonPlugin } from '@/plugins/json-plugin';
import { resolveOptions } from '@/store/boot/assert-name';
import { loadConfig, loadConfigSync } from '@/store/boot/load-config';
import { toMorselLayer } from '@/store/layer';

vi.mock('@/store/boot/assert-name', () => ({
  resolveOptions: vi.fn(),
  noop: vi.fn(),
}));
vi.mock('@/paths/resolve-paths', () => ({
  resolveGlobalPath: vi.fn(),
  resolveGlobalPathSync: vi.fn(),
  resolveProjectPath: vi.fn(),
  resolveProjectPathSync: vi.fn(),
}));
vi.mock('@/load/resolve-layer-sync', () => ({
  resolveLayerSync: vi.fn(),
}));
vi.mock('@/load/resolve-layer', () => ({
  resolveLayer: vi.fn(),
}));
vi.mock('@/load/merge-layers', () => ({
  mergeLayers: vi.fn(),
  applyMutability: vi.fn(),
}));
vi.mock('@/store/layer', () => ({
  toMorselLayer: vi.fn(),
}));
vi.mock('@/hooks/run-hooks', () => ({
  runHooksSync: vi.fn().mockReturnValue([]),
  runHooks: vi.fn().mockResolvedValue([]),
}));

function createResolvedOptions() {
  return {
    name: 'myapp',
    cwd: '/project',
    defaults: { a: 1 },
    overrides: { b: 2 },
    globalDir: '/global/dir',
    arrayMerge: 'replace' as const,
    envName: 'test',
    configMutability: 'frozen' as const,
    verbose: false,
    onDebug: (): void => {},
    formatPlugins: [jsonPlugin],
    validationPlugins: [],
    hooks: [],
    watch: true,
    proxy: true,
    queue: true,
  };
}

function createResolvedLayer(
  source: string,
  config: Record<string, unknown>,
): ResolvedLayer {
  return createMockLayer({
    source: source as ResolvedLayer['source'],
    path:
      source === 'defaults' || source === 'overrides'
        ? undefined
        : `/path/${source}`,
    config,
  }) as ResolvedLayer;
}

describe('loadConfigSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveOptions).mockReturnValue(createResolvedOptions());
    vi.mocked(resolveGlobalPathSync).mockReturnValue(
      '/global/dir/myapp.config.json',
    );
    vi.mocked(resolveProjectPathSync).mockReturnValue(
      '/project/myapp.config.json',
    );
    vi.mocked(mergeLayers).mockReturnValue({ merged: true });
    vi.mocked(applyMutability).mockReturnValue({ merged: true });
    vi.mocked(toMorselLayer).mockImplementation((layer) => ({
      source: layer.source,
      path: layer.path,
      config: layer.config,
      exists: layer.exists,
      extendsPaths: layer.extendsPaths,
    }));
  });

  it('calls resolveOptions with provided options', () => {
    vi.mocked(resolveLayerSync).mockReturnValue(
      createResolvedLayer('defaults', {}),
    );

    loadConfigSync({ name: 'myapp' });

    expect(resolveOptions).toHaveBeenCalledWith({ name: 'myapp' });
  });

  it('resolves global path using globalDir and name', () => {
    vi.mocked(resolveLayerSync).mockReturnValue(
      createResolvedLayer('defaults', {}),
    );

    loadConfigSync({ name: 'myapp' });

    expect(resolveLayerSync).toHaveBeenCalledWith(
      'global',
      '/global/dir/myapp.config.json',
      undefined,
      expect.objectContaining({ envName: 'test' }),
    );
  });

  it('resolves project path using resolveProjectPathSync', () => {
    vi.mocked(resolveLayerSync).mockReturnValue(
      createResolvedLayer('defaults', {}),
    );

    loadConfigSync({ name: 'myapp' });

    expect(resolveProjectPathSync).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'myapp' }),
      expect.any(Array),
    );
    expect(resolveLayerSync).toHaveBeenCalledWith(
      'project',
      '/project/myapp.config.json',
      undefined,
      expect.objectContaining({ envName: 'test' }),
    );
  });

  it('resolves four layers in order: defaults, global, project, overrides', () => {
    vi.mocked(resolveLayerSync).mockReturnValue(
      createResolvedLayer('defaults', {}),
    );

    loadConfigSync({ name: 'myapp' });

    const calls = vi.mocked(resolveLayerSync).mock.calls;
    expect(calls).toHaveLength(4);
    expect(calls[0]![0]).toBe('defaults');
    expect(calls[1]![0]).toBe('global');
    expect(calls[2]![0]).toBe('project');
    expect(calls[3]![0]).toBe('overrides');
  });

  it('passes defaults raw config to defaults layer', () => {
    vi.mocked(resolveLayerSync).mockReturnValue(
      createResolvedLayer('defaults', {}),
    );

    loadConfigSync({ name: 'myapp' });

    expect(resolveLayerSync).toHaveBeenCalledWith(
      'defaults',
      undefined,
      { a: 1 },
      expect.any(Object),
    );
  });

  it('passes overrides raw config to overrides layer', () => {
    vi.mocked(resolveLayerSync).mockReturnValue(
      createResolvedLayer('defaults', {}),
    );

    loadConfigSync({ name: 'myapp' });

    expect(resolveLayerSync).toHaveBeenCalledWith(
      'overrides',
      undefined,
      { b: 2 },
      expect.any(Object),
    );
  });

  it('passes envName and onDebug in layer options', () => {
    vi.mocked(resolveLayerSync).mockReturnValue(
      createResolvedLayer('defaults', {}),
    );

    loadConfigSync({ name: 'myapp' });

    expect(resolveLayerSync).toHaveBeenNthCalledWith(
      1,
      'defaults',
      undefined,
      { a: 1 },
      expect.objectContaining({
        envName: 'test',
        onDebug: expect.any(Function),
      }),
    );
    expect(resolveLayerSync).toHaveBeenNthCalledWith(
      2,
      'global',
      '/global/dir/myapp.config.json',
      undefined,
      expect.objectContaining({
        envName: 'test',
        onDebug: expect.any(Function),
      }),
    );
  });

  it('calls mergeLayers with resolved layers and arrayMerge strategy', () => {
    vi.mocked(resolveLayerSync).mockReturnValue(
      createResolvedLayer('defaults', {}),
    );

    loadConfigSync({ name: 'myapp' });

    expect(mergeLayers).toHaveBeenCalledWith(expect.any(Array), 'replace');
  });

  it('calls applyMutability with merged config and configMutability', () => {
    vi.mocked(resolveLayerSync).mockReturnValue(
      createResolvedLayer('defaults', {}),
    );
    vi.mocked(mergeLayers).mockReturnValue({ merged: true });

    loadConfigSync({ name: 'myapp' });

    expect(applyMutability).toHaveBeenCalledWith({ merged: true }, 'frozen');
  });

  it('returns config and layers mapped through toMorselLayer', () => {
    vi.mocked(resolveLayerSync)
      .mockReturnValueOnce(createResolvedLayer('defaults', { a: 1 }))
      .mockReturnValueOnce(createResolvedLayer('global', { g: 1 }))
      .mockReturnValueOnce(createResolvedLayer('project', { p: 1 }))
      .mockReturnValueOnce(createResolvedLayer('overrides', { b: 2 }));
    vi.mocked(applyMutability).mockReturnValue({ final: true });
    vi.mocked(toMorselLayer).mockImplementation((layer) => ({
      source: layer.source,
      path: layer.path,
      config: { ...layer.config },
      exists: layer.exists,
      extendsPaths: layer.extendsPaths,
    }));

    const result = loadConfigSync({ name: 'myapp' });

    expect(result.config).toEqual({ final: true });
    expect(result.layers).toHaveLength(4);
    expect(result.layers[0]!.source).toBe('defaults');
    expect(result.layers[1]!.source).toBe('global');
    expect(result.layers[2]!.source).toBe('project');
    expect(result.layers[3]!.source).toBe('overrides');
  });

  it('calls toMorselLayer for each resolved layer', () => {
    vi.mocked(resolveLayerSync).mockReturnValue(
      createResolvedLayer('defaults', {}),
    );

    loadConfigSync({ name: 'myapp' });

    expect(toMorselLayer).toHaveBeenCalledTimes(4);
  });

  it('calls runHooksSync with all 8 lifecycle points in order', () => {
    vi.mocked(resolveLayerSync).mockReturnValue(
      createResolvedLayer('defaults', {}),
    );

    loadConfigSync({ name: 'myapp' });

    const calls = vi.mocked(runHooksSync).mock.calls;
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
});

describe('loadConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveOptions).mockReturnValue(createResolvedOptions());
    vi.mocked(resolveGlobalPath).mockResolvedValue(
      '/global/dir/myapp.config.json',
    );
    vi.mocked(resolveProjectPath).mockResolvedValue(
      '/project/myapp.config.json',
    );
    vi.mocked(mergeLayers).mockReturnValue({ merged: true });
    vi.mocked(applyMutability).mockReturnValue({ merged: true });
    vi.mocked(toMorselLayer).mockImplementation((layer) => ({
      source: layer.source,
      path: layer.path,
      config: layer.config,
      exists: layer.exists,
      extendsPaths: layer.extendsPaths,
    }));
  });

  it('calls resolveOptions with provided options', async () => {
    vi.mocked(resolveLayer).mockResolvedValue(
      createResolvedLayer('defaults', {}),
    );

    await loadConfig({ name: 'myapp' });

    expect(resolveOptions).toHaveBeenCalledWith({ name: 'myapp' });
  });

  it('resolves global path using globalDir and name', async () => {
    vi.mocked(resolveLayer).mockResolvedValue(
      createResolvedLayer('defaults', {}),
    );

    await loadConfig({ name: 'myapp' });

    expect(resolveLayer).toHaveBeenCalledWith(
      'global',
      '/global/dir/myapp.config.json',
      undefined,
      expect.objectContaining({ envName: 'test' }),
    );
  });

  it('resolves project path using resolveProjectPath', async () => {
    vi.mocked(resolveLayer).mockResolvedValue(
      createResolvedLayer('defaults', {}),
    );

    await loadConfig({ name: 'myapp' });

    expect(resolveProjectPath).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'myapp' }),
      expect.any(Array),
    );
    expect(resolveLayer).toHaveBeenCalledWith(
      'project',
      '/project/myapp.config.json',
      undefined,
      expect.objectContaining({ envName: 'test' }),
    );
  });

  it('resolves four layers in order: defaults, global, project, overrides', async () => {
    vi.mocked(resolveLayer).mockResolvedValue(
      createResolvedLayer('defaults', {}),
    );

    await loadConfig({ name: 'myapp' });

    const calls = vi.mocked(resolveLayer).mock.calls;
    expect(calls).toHaveLength(4);
    expect(calls[0]![0]).toBe('defaults');
    expect(calls[1]![0]).toBe('global');
    expect(calls[2]![0]).toBe('project');
    expect(calls[3]![0]).toBe('overrides');
  });

  it('passes defaults raw config to defaults layer', async () => {
    vi.mocked(resolveLayer).mockResolvedValue(
      createResolvedLayer('defaults', {}),
    );

    await loadConfig({ name: 'myapp' });

    expect(resolveLayer).toHaveBeenCalledWith(
      'defaults',
      undefined,
      { a: 1 },
      expect.any(Object),
    );
  });

  it('passes overrides raw config to overrides layer', async () => {
    vi.mocked(resolveLayer).mockResolvedValue(
      createResolvedLayer('defaults', {}),
    );

    await loadConfig({ name: 'myapp' });

    expect(resolveLayer).toHaveBeenCalledWith(
      'overrides',
      undefined,
      { b: 2 },
      expect.any(Object),
    );
  });

  it('passes envName and onDebug in layer options', async () => {
    vi.mocked(resolveLayer).mockResolvedValue(
      createResolvedLayer('defaults', {}),
    );

    await loadConfig({ name: 'myapp' });

    expect(resolveLayer).toHaveBeenNthCalledWith(
      1,
      'defaults',
      undefined,
      { a: 1 },
      expect.objectContaining({
        envName: 'test',
        onDebug: expect.any(Function),
      }),
    );
    expect(resolveLayer).toHaveBeenNthCalledWith(
      2,
      'global',
      '/global/dir/myapp.config.json',
      undefined,
      expect.objectContaining({
        envName: 'test',
        onDebug: expect.any(Function),
      }),
    );
  });

  it('calls mergeLayers with resolved layers and arrayMerge strategy', async () => {
    vi.mocked(resolveLayer).mockResolvedValue(
      createResolvedLayer('defaults', {}),
    );

    await loadConfig({ name: 'myapp' });

    expect(mergeLayers).toHaveBeenCalledWith(expect.any(Array), 'replace');
  });

  it('calls applyMutability with merged config and configMutability', async () => {
    vi.mocked(resolveLayer).mockResolvedValue(
      createResolvedLayer('defaults', {}),
    );
    vi.mocked(mergeLayers).mockReturnValue({ merged: true });

    await loadConfig({ name: 'myapp' });

    expect(applyMutability).toHaveBeenCalledWith({ merged: true }, 'frozen');
  });

  it('returns config and layers mapped through toMorselLayer', async () => {
    vi.mocked(resolveLayer)
      .mockResolvedValueOnce(createResolvedLayer('defaults', { a: 1 }))
      .mockResolvedValueOnce(createResolvedLayer('global', { g: 1 }))
      .mockResolvedValueOnce(createResolvedLayer('project', { p: 1 }))
      .mockResolvedValueOnce(createResolvedLayer('overrides', { b: 2 }));
    vi.mocked(applyMutability).mockReturnValue({ final: true });
    vi.mocked(toMorselLayer).mockImplementation((layer) => ({
      source: layer.source,
      path: layer.path,
      config: { ...layer.config },
      exists: layer.exists,
      extendsPaths: layer.extendsPaths,
    }));

    const result = await loadConfig({ name: 'myapp' });

    expect(result.config).toEqual({ final: true });
    expect(result.layers).toHaveLength(4);
    expect(result.layers[0]!.source).toBe('defaults');
    expect(result.layers[1]!.source).toBe('global');
    expect(result.layers[2]!.source).toBe('project');
    expect(result.layers[3]!.source).toBe('overrides');
  });

  it('calls toMorselLayer for each resolved layer', async () => {
    vi.mocked(resolveLayer).mockResolvedValue(
      createResolvedLayer('defaults', {}),
    );

    await loadConfig({ name: 'myapp' });

    expect(toMorselLayer).toHaveBeenCalledTimes(4);
  });

  it('calls runHooks with all 8 lifecycle points in order', async () => {
    vi.mocked(resolveLayer).mockResolvedValue(
      createResolvedLayer('defaults', {}),
    );

    await loadConfig({ name: 'myapp' });

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
});
