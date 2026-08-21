import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('watcher-extends-new-directory — re-merge adds extends in new dir', () => {
  clearWatcherRegistry();

  it('adding extends to file in new directory creates watcher for that dir', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;
    const subdirectory = `${projectDirectory}/sub`;

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });
    await mkdir(`${directory}/global`, { recursive: true });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
    });

    expect(store.config).toEqual({ port: 3000 });

    await writeConfig(subdirectory, 'base.json', { port: 4000 });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './sub/base.json',
    });

    await waitForRemerge(
      store,
      (config) => (config as Record<string, unknown>)['port'] === 4000,
    );

    expect(store.config).toEqual({ port: 4000 });

    await writeConfig(subdirectory, 'base.json', { port: 8080 });
    await waitForRemerge(
      store,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    expect(store.config).toEqual({ port: 8080 });

    await store.stop();
  });
});
