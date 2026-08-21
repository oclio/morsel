import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('env-override — $env.ci applied when envName: ci', () => {
  clearWatcherRegistry();

  it('overrides keys from $env block matching envName', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      host: 'localhost',
      timeout: 5000,
      $env: {
        ci: { port: 8080, host: '0.0.0.0' },
      },
    });

    const { config, layers } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      envName: 'ci',
    });

    expect(config).toEqual({ port: 8080, host: '0.0.0.0', timeout: 5000 });

    const projectLayer = layers.find((layer) => layer.source === 'project');
    expect(projectLayer!.config).not.toHaveProperty('$env');
    expect(projectLayer!.config).not.toHaveProperty('extends');
  });
});
