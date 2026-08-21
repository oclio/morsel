import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('edge-node-env-live-change — envName stays at boot value', () => {
  clearWatcherRegistry();

  it('NODE_ENV change after boot does not affect envName', async () => {
    const previousNodeEnvironment = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'development';

    try {
      const { directory } = await createTemporaryEnvironment();
      const projectDirectory = `${directory}/project`;
      const globalDirectory = `${directory}/global`;

      await mkdir(projectDirectory, { recursive: true });
      await mkdir(globalDirectory, { recursive: true });
      await writeConfig(projectDirectory, 'myapp.config.json', {
        port: 3000,
        label: 'base',
        $env: {
          development: { label: 'dev' },
          production: { label: 'prod' },
        },
      });

      const store = await watchConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
      });

      expect(store.config).toEqual({ port: 3000, label: 'dev' });

      process.env['NODE_ENV'] = 'production';

      const portChanged = new Promise<void>((resolve) => {
        store.on('port', () => resolve());
      });

      await writeConfig(projectDirectory, 'myapp.config.json', {
        port: 8080,
        label: 'base',
        $env: {
          development: { label: 'dev' },
          production: { label: 'prod' },
        },
      });

      await portChanged;

      expect(store.config).toEqual({ port: 8080, label: 'dev' });
    } finally {
      if (previousNodeEnvironment === undefined) {
        delete process.env['NODE_ENV'];
      } else {
        process.env['NODE_ENV'] = previousNodeEnvironment;
      }
    }
  });
});
