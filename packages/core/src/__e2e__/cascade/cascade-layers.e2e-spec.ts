import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import type { Hook } from '@/index';
import { loadConfig } from '@/index';

describe('cascade-layers — layer trace', () => {
  let directory: string;
  let projectDirectory: string;
  let globalDirectory: string;

  beforeEach(async () => {
    clearWatcherRegistry();
    const env = await createTemporaryEnvironment();
    directory = env.directory;
    projectDirectory = `${directory}/project`;
    globalDirectory = `${directory}/global`;
  });

  it('layers[] has 4 entries in order with coherent source/path/exists', async () => {
    await writeConfig(globalDirectory, 'myapp.config.json', { port: 8080 });
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const { layers } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { port: 4000 },
      overrides: { debug: true },
    });

    expect(layers).toHaveLength(4);

    const [defaultsLayer, globalLayer, projectLayer, overridesLayer] = layers;

    expect(defaultsLayer!.source).toBe('defaults');
    expect(defaultsLayer!.exists).toBe(true);
    expect(defaultsLayer!.path).toBeUndefined();
    expect(defaultsLayer!.extendsPaths).toHaveLength(0);
    expect(defaultsLayer!.config).toEqual({ port: 4000 });

    expect(globalLayer!.source).toBe('global');
    expect(globalLayer!.exists).toBe(true);
    expect(globalLayer!.path).toBeDefined();
    expect(globalLayer!.extendsPaths).toHaveLength(0);
    expect(globalLayer!.config).toEqual({ port: 8080 });

    expect(projectLayer!.source).toBe('project');
    expect(projectLayer!.exists).toBe(true);
    expect(projectLayer!.path).toBeDefined();
    expect(projectLayer!.extendsPaths).toHaveLength(0);
    expect(projectLayer!.config).toEqual({ port: 3000 });

    expect(overridesLayer!.source).toBe('overrides');
    expect(overridesLayer!.exists).toBe(true);
    expect(overridesLayer!.path).toBeUndefined();
    expect(overridesLayer!.extendsPaths).toHaveLength(0);
    expect(overridesLayer!.config).toEqual({ debug: true });
  });

  it('layers with hooks intercalated — 4 core + N hooks in correct order', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const hooks: readonly Hook[] = [
      {
        name: 'before-defaults-hook',
        lifecycle: 'before:defaults',
        load: () => ({ beforeDefaults: true }),
      },
      {
        name: 'after-global-hook',
        lifecycle: 'after:global',
        load: () => ({ afterGlobal: true }),
      },
      {
        name: 'after-overrides-hook',
        lifecycle: 'after:overrides',
        load: () => ({ afterOverrides: true }),
      },
    ];

    const { layers } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults: { port: 4000 },
      overrides: { debug: true },
      hooks,
    });

    expect(layers).toHaveLength(7);

    expect(layers[0]!.source).toBe('hook');
    expect(layers[0]!.hookName).toBe('before-defaults-hook');

    expect(layers[1]!.source).toBe('defaults');

    expect(layers[2]!.source).toBe('global');

    expect(layers[3]!.source).toBe('hook');
    expect(layers[3]!.hookName).toBe('after-global-hook');

    expect(layers[4]!.source).toBe('project');

    expect(layers[5]!.source).toBe('overrides');

    expect(layers[6]!.source).toBe('hook');
    expect(layers[6]!.hookName).toBe('after-overrides-hook');
  });

  it('layer with non-empty extendsPaths when extending a file', async () => {
    await writeConfig(projectDirectory, 'base.json', { host: 'localhost' });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      extends: './base.json',
    });

    const { layers } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    const projectLayer = layers.find((layer) => layer.source === 'project');
    expect(projectLayer).toBeDefined();
    expect(projectLayer!.extendsPaths).toHaveLength(1);
    expect(projectLayer!.extendsPaths[0]).toContain('base.json');
  });

  it('hook layer has hookName, core layers do not', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const hooks: readonly Hook[] = [
      {
        name: 'test-hook',
        lifecycle: 'before:defaults',
        load: () => ({ hookKey: true }),
      },
    ];

    const { layers } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      hooks,
    });

    const hookLayer = layers.find((layer) => layer.source === 'hook');
    expect(hookLayer).toBeDefined();
    expect(hookLayer!.hookName).toBe('test-hook');

    const coreLayers = layers.filter((layer) => layer.source !== 'hook');
    for (const layer of coreLayers) {
      expect(layer.hookName).toBeUndefined();
    }
  });
});
