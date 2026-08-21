import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('extends-per-file-env — $env applied per file before extends merge', () => {
  clearWatcherRegistry();

  it('each file applies its own $env before merge', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'base.json', {
      port: 4000,
      $env: {
        ci: { port: 8080 },
      },
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './base.json',
      host: 'localhost',
      $env: {
        ci: { host: '0.0.0.0' },
      },
    });

    const previousNodeEnvironment = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'ci';

    try {
      const { config } = await loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: `${directory}/global`,
      });

      expect(config).toEqual({ port: 8080, host: '0.0.0.0' });
    } finally {
      if (previousNodeEnvironment === undefined) {
        delete process.env['NODE_ENV'];
      } else {
        process.env['NODE_ENV'] = previousNodeEnvironment;
      }
    }
  });
});
