import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  waitForRemerge,
} from '@oclio/morsel-e2e-helpers';

import { initConfig, watchConfig } from '@/index';

describe('init-config-triggers-watch — initConfig during active watch', () => {
  clearWatcherRegistry();

  it('initConfig creates file → fs.watch fires → re-merge → events emitted', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await mkdir(projectDirectory, { recursive: true });
    await mkdir(`${directory}/global`, { recursive: true });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      defaults: { port: 3000 },
    });

    expect(store.config).toEqual({ port: 3000 });

    initConfig({
      name: 'myapp',
      cwd: projectDirectory,
      content: { port: 8080 },
    });

    await waitForRemerge(store, (config) => config['port'] === 8080);

    expect(store.config).toEqual({ port: 8080 });

    await store.stop();
  });
});
