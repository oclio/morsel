import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('mutability-layers — layer audit trace', () => {
  let directory: string;
  let projectDirectory: string;
  let globalDirectory: string;

  beforeEach(async () => {
    clearWatcherRegistry();
    const env = await createTemporaryEnvironment();
    directory = env.directory;
    projectDirectory = `${directory}/project`;
    globalDirectory = `${directory}/global`;
    await mkdir(projectDirectory, { recursive: true });
    await mkdir(globalDirectory, { recursive: true });
  });

  it('layers always frozen regardless of configMutability', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      nested: { key: 'val' },
    });

    const { layers } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      configMutability: 'mutable',
    });

    for (const layer of layers) {
      expect(Object.isFrozen(layer.config)).toBe(true);
      expect(Object.isFrozen(layer.extendsPaths)).toBe(true);
    }
  });

  it('layers readable in mutable mode — audit trace preserved', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const { layers } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      configMutability: 'mutable',
    });

    const projectLayer = layers.find((layer) => layer.source === 'project');
    expect(projectLayer).toBeDefined();
    expect(projectLayer!.exists).toBe(true);
    expect(projectLayer!.config).toEqual({ port: 3000 });
  });
});
