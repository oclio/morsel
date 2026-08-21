import { rm } from 'node:fs/promises';

import { clearWatcherRegistry, setupTest } from '@oclio/morsel-e2e-helpers';

describe('watch-delete-project-file — delete project file keeps last valid config', () => {
  clearWatcherRegistry();

  it('deleting project file keeps last valid config frozen', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000, host: 'localhost' },
      createGlobalDir: true,
      defaults: { port: 4000 },
      onDebug: () => {},
    });

    expect(store!.config).toEqual({ port: 3000, host: 'localhost' });

    await rm(`${projectDirectory}/myapp.config.json`);

    // Give the watcher time to fire — config should NOT change.
    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(store!.config).toEqual({ port: 3000, host: 'localhost' });

    await store!.stop();
  });
});
