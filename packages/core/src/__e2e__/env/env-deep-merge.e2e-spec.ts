import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('env-deep-merge — $env block deep-merges with file body', () => {
  clearWatcherRegistry();

  it('$env.ci nested object merges with file body, not replaces', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', {
      tools: { eslint: true, prettier: true },
      server: { db: { host: 'localhost', port: 5432 } },
      $env: {
        ci: {
          tools: { eslint: false },
          server: { db: { port: 9999 } },
        },
      },
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      envName: 'ci',
    });

    expect(config).toEqual({
      tools: { eslint: false, prettier: true },
      server: { db: { host: 'localhost', port: 9999 } },
    });
  });
});
