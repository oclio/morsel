import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('env-stripped — $env absent from final config and layer.config', () => {
  clearWatcherRegistry();

  it('$env key not in config nor in any layer.config', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      $env: {
        ci: { port: 8080 },
      },
      extends: './base.json',
    });

    const { config, layers } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      envName: 'ci',
    });

    expect(config).not.toHaveProperty('$env');
    expect(config).not.toHaveProperty('extends');

    for (const layer of layers) {
      expect(layer.config).not.toHaveProperty('$env');
      expect(layer.config).not.toHaveProperty('extends');
    }
  });
});
