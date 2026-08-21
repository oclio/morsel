import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('env-nested-env — $env inside $env block is stripped', () => {
  clearWatcherRegistry();

  it('nested $env within $env block is not applied recursively', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      $env: {
        ci: {
          port: 8080,
          $env: {
            prod: { port: 9999 },
          },
        },
      },
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      envName: 'ci',
    });

    expect(config).toEqual({ port: 8080 });
    expect(config).not.toHaveProperty('$env');
  });
});
