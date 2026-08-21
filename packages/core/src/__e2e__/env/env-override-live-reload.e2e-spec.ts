import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('env-override-live-reload — modifying $env block triggers re-merge', () => {
  clearWatcherRegistry();

  it('editing $env block applies new env values after re-merge', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      $env: {
        ci: { port: 8080 },
      },
    });

    await mkdir(`${directory}/global`, { recursive: true });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      envName: 'ci',
    });

    expect(store.config).toEqual({ port: 8080 });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      $env: {
        ci: { port: 9090 },
      },
    });

    await waitForRemerge(store, (config) => config['port'] === 9090);

    expect(store.config).toEqual({ port: 9090 });

    await store.stop();
  });
});
