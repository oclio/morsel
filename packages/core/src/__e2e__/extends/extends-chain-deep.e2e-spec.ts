import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('extends-chain-deep — A extends B extends C', () => {
  clearWatcherRegistry();

  it('merge = deepMerge(C, B, A), extendsPaths = [C, B]', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'c.json', {
      port: 9000,
      host: '0.0.0.0',
      timeout: 5000,
    });
    await writeConfig(projectDirectory, 'b.json', {
      extends: './c.json',
      port: 8080,
      host: 'localhost',
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './b.json',
      port: 3000,
    });

    const { config, layers } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
    });

    expect(config).toEqual({ port: 3000, host: 'localhost', timeout: 5000 });

    const projectLayer = layers.find((layer) => layer.source === 'project');
    expect(projectLayer).toBeDefined();
    expect(projectLayer!.extendsPaths).toHaveLength(2);
    expect(projectLayer!.extendsPaths[0]).toContain('c.json');
    expect(projectLayer!.extendsPaths[1]).toContain('b.json');
  });
});
