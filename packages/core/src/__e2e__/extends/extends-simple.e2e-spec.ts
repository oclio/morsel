import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('extends-simple — A extends B', () => {
  clearWatcherRegistry();

  it('config = deepMerge(B, A), extendsPaths contains resolved B', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'base.json', {
      port: 8080,
      host: '0.0.0.0',
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './base.json',
      port: 3000,
    });

    const { config, layers } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
    });

    expect(config).toEqual({ port: 3000, host: '0.0.0.0' });

    const projectLayer = layers.find((layer) => layer.source === 'project');
    expect(projectLayer).toBeDefined();
    expect(projectLayer!.extendsPaths).toHaveLength(1);
    expect(projectLayer!.extendsPaths[0]).toContain('base.json');
  });
});
