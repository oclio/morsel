import {
  createMockLayer,
  createMockResolvedOptions,
} from '@oclio/test-helpers';

import { runHooksSync } from '@/hooks/run-hooks';
import { buildLayers } from '@/load/build-layers';
import { processConfig } from '@/load/process-config';
import type { ResolvedLayer } from '@/load/resolve-layer';
import { resolveLayerSync } from '@/load/resolve-layer-sync';
import {
  resolveGlobalPath,
  resolveGlobalPathSync,
  resolveProjectPath,
  resolveProjectPathSync,
} from '@/paths/resolve-paths';
import { jsonPlugin } from '@/plugins/json-plugin';
import type { ResolvedOptions } from '@/store/boot/assert-name';
import { resolveOptions } from '@/store/boot/assert-name';
import {
  loadConfig,
  loadConfigSync,
  loadPipeline,
} from '@/store/boot/load-config';
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
vi.mock('@/store/layer', () => ({
  toMorselLayer: vi.fn(),
}));
vi.mock('@/hooks/run-hooks', () => ({
  runHooksSync: vi.fn().mockReturnValue([]),
}));
vi.mock('@/load/build-layers', () => ({
  buildLayers: vi.fn(),
}));
vi.mock('@/load/process-config', () => ({
  processConfig: vi.fn(),
}));

function createResolvedOptions(): ResolvedOptions {
  return createMockResolvedOptions({
    defaults: { a: 1 },
    overrides: { b: 2 },
    globalDir: '/global/dir',
    formatPlugins: [jsonPlugin],
  }) as ResolvedOptions;
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
    vi.mocked(processConfig).mockReturnValue({
      config: { merged: true },
      merged: { merged: true },
      validated: { merged: true },
    } as never);
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

  it('calls processConfig with layers, arrayMerge, validationPlugins, and mutability', () => {
    vi.mocked(resolveLayerSync).mockReturnValue(
      createResolvedLayer('defaults', {}),
    );

    loadConfigSync({ name: 'myapp' });

    expect(processConfig).toHaveBeenCalledWith(
      expect.any(Array),
      'replace',
      expect.any(Array),
      'frozen',
    );
  });

  it('returns config and layers mapped through toMorselLayer', () => {
    vi.mocked(resolveLayerSync)
      .mockReturnValueOnce(createResolvedLayer('defaults', { a: 1 }))
      .mockReturnValueOnce(createResolvedLayer('global', { g: 1 }))
      .mockReturnValueOnce(createResolvedLayer('project', { p: 1 }))
      .mockReturnValueOnce(createResolvedLayer('overrides', { b: 2 }));
    vi.mocked(processConfig).mockReturnValue({
      config: { final: true },
      merged: { final: true },
      validated: { final: true },
    } as never);
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

describe('loadPipeline', () => {
  const mockLayers: ResolvedLayer[] = [
    createResolvedLayer('defaults', { a: 1 }),
    createResolvedLayer('global', { g: 1 }),
    createResolvedLayer('project', { p: 1 }),
    createResolvedLayer('overrides', { b: 2 }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveGlobalPath).mockResolvedValue(
      '/global/dir/myapp.config.json',
    );
    vi.mocked(resolveProjectPath).mockResolvedValue(
      '/project/myapp.config.json',
    );
    vi.mocked(buildLayers).mockResolvedValue(mockLayers);
    vi.mocked(processConfig).mockReturnValue({
      config: { final: true },
      merged: { final: true },
      validated: { final: true },
    } as never);
    vi.mocked(toMorselLayer).mockImplementation((layer) => ({
      source: layer.source,
      path: layer.path,
      config: { ...layer.config },
      exists: layer.exists,
      extendsPaths: layer.extendsPaths,
    }));
  });

  it('resolves global and project paths', async () => {
    const resolved = createResolvedOptions();
    await loadPipeline(resolved);

    expect(resolveGlobalPath).toHaveBeenCalledWith(
      resolved,
      resolved.formatPlugins,
    );
    expect(resolveProjectPath).toHaveBeenCalledWith(
      resolved,
      resolved.formatPlugins,
    );
  });

  it('calls buildLayers with resolved options, paths, and triggerRemerge', async () => {
    const resolved = createResolvedOptions();
    const trigger = vi.fn();
    await loadPipeline(resolved, trigger);

    expect(buildLayers).toHaveBeenCalledWith(
      resolved,
      '/global/dir/myapp.config.json',
      '/project/myapp.config.json',
      trigger,
    );
  });

  it('defaults triggerRemerge to noop when not provided', async () => {
    const resolved = createResolvedOptions();
    await loadPipeline(resolved);

    expect(buildLayers).toHaveBeenCalledWith(
      resolved,
      '/global/dir/myapp.config.json',
      '/project/myapp.config.json',
      expect.any(Function),
    );
  });

  it('calls processConfig with layers, arrayMerge, validationPlugins, and mutability', async () => {
    const resolved = createResolvedOptions();
    await loadPipeline(resolved);

    expect(processConfig).toHaveBeenCalledWith(
      mockLayers,
      resolved.arrayMerge,
      resolved.validationPlugins,
      resolved.configMutability,
    );
  });

  it('returns config, layers, morselLayers, and projectPath', async () => {
    const resolved = createResolvedOptions();
    const result = await loadPipeline(resolved);

    expect(result.config).toEqual({ final: true });
    expect(result.layers).toBe(mockLayers);
    expect(result.morselLayers).toHaveLength(4);
    expect(result.morselLayers[0]!.source).toBe('defaults');
    expect(result.morselLayers[1]!.source).toBe('global');
    expect(result.morselLayers[2]!.source).toBe('project');
    expect(result.morselLayers[3]!.source).toBe('overrides');
    expect(result.projectPath).toBe('/project/myapp.config.json');
  });

  it('maps each layer through toMorselLayer', async () => {
    await loadPipeline(createResolvedOptions());

    expect(toMorselLayer).toHaveBeenCalledTimes(4);
  });
});

describe('loadConfig', () => {
  const mockLayers: ResolvedLayer[] = [
    createResolvedLayer('defaults', { a: 1 }),
    createResolvedLayer('global', { g: 1 }),
    createResolvedLayer('project', { p: 1 }),
    createResolvedLayer('overrides', { b: 2 }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveOptions).mockReturnValue(createResolvedOptions());
    vi.mocked(resolveGlobalPath).mockResolvedValue(
      '/global/dir/myapp.config.json',
    );
    vi.mocked(resolveProjectPath).mockResolvedValue(
      '/project/myapp.config.json',
    );
    vi.mocked(buildLayers).mockResolvedValue(mockLayers);
    vi.mocked(processConfig).mockReturnValue({
      config: { final: true },
      merged: { final: true },
      validated: { final: true },
    } as never);
    vi.mocked(toMorselLayer).mockImplementation((layer) => ({
      source: layer.source,
      path: layer.path,
      config: { ...layer.config },
      exists: layer.exists,
      extendsPaths: layer.extendsPaths,
    }));
  });

  it('calls resolveOptions with provided options', async () => {
    await loadConfig({ name: 'myapp' });

    expect(resolveOptions).toHaveBeenCalledWith({ name: 'myapp' });
  });

  it('delegates to loadPipeline and returns config and morselLayers', async () => {
    const result = await loadConfig({ name: 'myapp' });

    expect(result.config).toEqual({ final: true });
    expect(result.layers).toHaveLength(4);
    expect(result.layers[0]!.source).toBe('defaults');
    expect(result.layers[1]!.source).toBe('global');
    expect(result.layers[2]!.source).toBe('project');
    expect(result.layers[3]!.source).toBe('overrides');
  });

  it('calls toMorselLayer for each resolved layer', async () => {
    await loadConfig({ name: 'myapp' });

    expect(toMorselLayer).toHaveBeenCalledTimes(4);
  });
});
