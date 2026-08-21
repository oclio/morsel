import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('env-per-file — $env in extends file applied independently', () => {
  clearWatcherRegistry();

  it('each file in extends chain applies its own $env before merge', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'base.json', {
      port: 4000,
      host: '0.0.0.0',
      $env: {
        ci: { port: 8080 },
      },
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './base.json',
      host: 'localhost',
      $env: {
        ci: { host: '127.0.0.1' },
      },
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      envName: 'ci',
    });

    expect(config).toEqual({ port: 8080, host: '127.0.0.1' });
  });
});
