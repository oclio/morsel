import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('env-stripped — $env stripped from result', () => {
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

  it('$env key not in config nor in any layer.config', async () => {
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
      globalDir: globalDirectory,
      envName: 'ci',
    });

    expect(config).not.toHaveProperty('$env');
    expect(config).not.toHaveProperty('extends');

    for (const layer of layers) {
      expect(layer.config).not.toHaveProperty('$env');
      expect(layer.config).not.toHaveProperty('extends');
    }
  });

  it('$env stripped from all 4 layers simultaneously', async () => {
    await writeConfig(globalDirectory, 'myapp.config.json', {
      port: 8080,
      $env: { ci: { port: 9090 } },
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      $env: { ci: { port: 9000 } },
    });

    const { config, layers } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      envName: 'ci',
      defaults: { port: 4000, $env: { ci: { port: 7000 } } },
      overrides: { port: 6000, $env: { ci: { port: 9999 } } },
    });

    expect(config).not.toHaveProperty('$env');

    for (const layer of layers) {
      expect(layer.config).not.toHaveProperty('$env');
    }
  });
});
