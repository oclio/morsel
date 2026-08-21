import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('watcher-extends-removed-directory — re-merge removes extends', () => {
  clearWatcherRegistry();

  it('removing extends releases watcher on the extends directory', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'base.json', { port: 4000 });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './base.json',
    });
    await mkdir(`${directory}/global`, { recursive: true });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
    });

    expect(store.config).toEqual({ port: 4000 });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });
    await waitForRemerge(
      store,
      (config) => (config as Record<string, unknown>)['port'] === 3000,
    );

    expect(store.config).toEqual({ port: 3000 });

    await writeConfig(projectDirectory, 'base.json', { port: 9999 });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(store.config).toEqual({ port: 3000 });

    await store.stop();
  });
});
