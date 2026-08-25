import { mkdir, writeFile } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  setupTest,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('boot-discovery — path resolution', () => {
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

  it('discovers project file in .config/ subdirectory', async () => {
    await mkdir(`${projectDirectory}/.config`, { recursive: true });
    await writeConfig(`${projectDirectory}/.config`, 'myapp.json', {
      port: 3000,
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(config).toEqual({ port: 3000 });
  });

  it('prefers <cwd>/<name>.config.* over <cwd>/.config/<name>.* when both exist', async () => {
    await mkdir(projectDirectory, { recursive: true });
    await mkdir(`${projectDirectory}/.config`, { recursive: true });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });
    await writeConfig(`${projectDirectory}/.config`, 'myapp.json', {
      port: 9000,
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(config).toEqual({ port: 3000 });
  });

  it('globalDir pointing to nonexistent directory → global layer exists:false, config:{}', async () => {
    await mkdir(projectDirectory, { recursive: true });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    const { config, layers } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/nonexistent-global`,
    });

    expect(config).toEqual({ port: 3000 });

    const globalLayer = layers.find((l) => l.source === 'global');
    expect(globalLayer!.exists).toBe(false);
    expect(globalLayer!.config).toEqual({});
  });

  it('global layer exists:false, config = defaults + project + overrides', async () => {
    const { result } = await setupTest({
      createGlobalDir: true,
      projectConfig: { host: 'localhost' },
      defaults: { port: 3000 },
      overrides: { debug: true },
    });

    const { config, layers } = result!;

    expect(config).toEqual({ port: 3000, host: 'localhost', debug: true });

    const [defaultsLayer, globalLayer, projectLayer, overridesLayer] = layers;

    expect(defaultsLayer!.source).toBe('defaults');
    expect(defaultsLayer!.exists).toBe(true);

    expect(globalLayer!.source).toBe('global');
    expect(globalLayer!.exists).toBe(false);
    expect(globalLayer!.config).toEqual({});
    expect(globalLayer!.path).toBeUndefined();

    expect(projectLayer!.source).toBe('project');
    expect(projectLayer!.exists).toBe(true);

    expect(overridesLayer!.source).toBe('overrides');
    expect(overridesLayer!.exists).toBe(true);
  });

  it('project layer exists:false, config:{}, path:undefined', async () => {
    const { result } = await setupTest({
      globalConfig: { host: '0.0.0.0' },
      defaults: { port: 3000 },
      overrides: { debug: true },
    });

    const { config, layers } = result!;

    expect(config).toEqual({ port: 3000, host: '0.0.0.0', debug: true });

    const [defaultsLayer, globalLayer, projectLayer, overridesLayer] = layers;

    expect(defaultsLayer!.source).toBe('defaults');
    expect(defaultsLayer!.exists).toBe(true);

    expect(globalLayer!.source).toBe('global');
    expect(globalLayer!.exists).toBe(true);

    expect(projectLayer!.source).toBe('project');
    expect(projectLayer!.exists).toBe(false);
    expect(projectLayer!.config).toEqual({});
    expect(projectLayer!.path).toBeUndefined();

    expect(overridesLayer!.source).toBe('overrides');
    expect(overridesLayer!.exists).toBe(true);
  });

  it('empty {} config file → layer exists, config empty, no error', async () => {
    const { result } = await setupTest({ projectConfig: {} });

    expect(result!.config).toEqual({});
    const projectLayer = result!.layers.find(
      (layer) => layer.source === 'project',
    );
    expect(projectLayer).toBeDefined();
    expect(projectLayer?.exists).toBe(true);
    expect(projectLayer?.config).toEqual({});
  });

  it('overlapping nested keys: overrides win per-key via deep merge, not full replace', async () => {
    const { result } = await setupTest({
      rootAsCwd: true,
      defaults: {
        server: { host: 'localhost', port: 3000 },
        features: { cache: true, auth: false },
      },
      overrides: {
        server: { port: 9000 },
        features: { auth: true },
      },
    });

    const { config, layers } = result!;

    expect(config).toEqual({
      server: { host: 'localhost', port: 9000 },
      features: { cache: true, auth: true },
    });

    const [defaultsLayer, globalLayer, projectLayer, overridesLayer] = layers;

    expect(defaultsLayer!.source).toBe('defaults');
    expect(defaultsLayer!.exists).toBe(true);
    expect(defaultsLayer!.config).toEqual({
      server: { host: 'localhost', port: 3000 },
      features: { cache: true, auth: false },
    });

    expect(globalLayer!.source).toBe('global');
    expect(globalLayer!.exists).toBe(false);

    expect(projectLayer!.source).toBe('project');
    expect(projectLayer!.exists).toBe(false);

    expect(overridesLayer!.source).toBe('overrides');
    expect(overridesLayer!.exists).toBe(true);
    expect(overridesLayer!.config).toEqual({
      server: { port: 9000 },
      features: { auth: true },
    });
  });

  it('global present + project absent → global config used, project layer exists:false', async () => {
    const { result } = await setupTest({
      globalConfig: { host: '0.0.0.0', port: 8080 },
      defaults: { port: 3000 },
    });

    const { config, layers } = result!;

    expect(config).toEqual({ host: '0.0.0.0', port: 8080 });

    const projectLayer = layers.find((l) => l.source === 'project');
    expect(projectLayer!.exists).toBe(false);

    const globalLayer = layers.find((l) => l.source === 'global');
    expect(globalLayer!.exists).toBe(true);
  });

  it('boot with custom formatPlugins discovers matching extension', async () => {
    const yamlPlugin = {
      name: 'yaml',
      extensions: ['.yaml', '.yml'],
      parse: () => ({ port: 4000 }),
      serialize: () => '',
    };

    await mkdir(projectDirectory, { recursive: true });
    await writeFile(
      `${projectDirectory}/myapp.config.yaml`,
      'port: 4000',
      'utf8',
    );

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      formatPlugins: [yamlPlugin],
    });

    expect(config).toEqual({ port: 4000 });
  });
});
