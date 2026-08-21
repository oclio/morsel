import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('extends-stripped-from-result — extends key not in final config', () => {
  clearWatcherRegistry();

  it('extends does not appear in config or layer.config', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'base.json', { port: 8080 });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './base.json',
      port: 3000,
    });

    const { config, layers } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
    });

    expect(config).not.toHaveProperty('extends');

    for (const layer of layers) {
      expect(layer.config).not.toHaveProperty('extends');
    }
  });
});
