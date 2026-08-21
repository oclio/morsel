import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { setupDeletedDirectoryScenario } from './_setup-deleted-directory';

describe('watcher-directory-recreated — delete then recreate dir → re-attach', () => {
  clearWatcherRegistry();

  it('directory recreated after deletion → future fires captured', async () => {
    const { store, projectDirectory } = await setupDeletedDirectoryScenario();

    await mkdir(projectDirectory, { recursive: true });
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });

    await waitForRemerge(
      store,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    expect(store.config).toEqual({ port: 8080 });

    await store.stop();
  });
});
