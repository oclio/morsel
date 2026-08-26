import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('boot-mutability — freeze + layer shape', () => {
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

  it('Object.isFrozen(config) is true by default', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      tools: { eslint: true },
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(Object.isFrozen(config)).toBe(true);
  });

  it('config is not frozen and can be mutated freely', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      configMutability: 'mutable',
    });

    expect(Object.isFrozen(config)).toBe(false);

    const mutable = config as Record<string, unknown>;
    mutable['port'] = 8080;
    expect(mutable['port']).toBe(8080);
  });

  it('MorselLayer shape: extendsPaths: [] on layers without extends, no hookName on core layers', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const { layers } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    for (const layer of layers) {
      expect(layer).toHaveProperty('extendsPaths');
      expect(Array.isArray(layer.extendsPaths)).toBe(true);
      expect(layer.extendsPaths).toHaveLength(0);
      expect(layer).not.toHaveProperty('hookName');
    }
  });

  it('layers[].config is deep-frozen by toMorselLayer', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      nested: { deep: { value: true } },
    });

    const { layers } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    const projectLayer = layers.find((l) => l.source === 'project');
    expect(Object.isFrozen(projectLayer!.config)).toBe(true);

    const nested = (projectLayer!.config as Record<string, unknown>)[
      'nested'
    ] as Record<string, unknown>;
    expect(Object.isFrozen(nested)).toBe(true);

    const deep = nested['deep'] as Record<string, unknown>;
    expect(Object.isFrozen(deep)).toBe(true);
  });
});
