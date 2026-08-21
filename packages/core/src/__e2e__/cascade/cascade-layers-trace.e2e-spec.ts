import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('cascade-layers-trace — 4 core layers with correct metadata', () => {
  clearWatcherRegistry();

  it('layers[] has 4 entries in order with coherent source/path/exists', async () => {
    const { directory } = await createTemporaryEnvironment();
    const globalDirectoryPath = `${directory}/global`;
    const projectDirectory = `${directory}/project`;

    await writeConfig(globalDirectoryPath, 'myapp.config.json', { port: 8080 });
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const { layers } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectoryPath,
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
});
