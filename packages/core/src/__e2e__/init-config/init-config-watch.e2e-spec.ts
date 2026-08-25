import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  waitForRemerge,
} from '@oclio/morsel-e2e-helpers';

import { initConfig, watchConfig } from '@/index';

describe('init-config-watch — watch integration', () => {
  let directory: string;
  let projectDirectory: string;
  let globalDirectory: string;

  beforeEach(async () => {
    clearWatcherRegistry();
    const env = await createTemporaryEnvironment();
    directory = env.directory;
    projectDirectory = `${directory}/project`;
    globalDirectory = `${directory}/global`;
    await mkdir(projectDirectory, { recursive: true });
    await mkdir(globalDirectory, { recursive: true });
  });

  it('initConfig during active watch → fs.watch fires → re-merge', async () => {
    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
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
