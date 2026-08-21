import { rm } from 'node:fs/promises';
import path from 'node:path';

import { clearWatcherRegistry, setupTest } from '@oclio/morsel-e2e-helpers';

describe('watch-delete-global-file — delete global file keeps last valid config', () => {
  clearWatcherRegistry();

  it('global layer disappears → config stays frozen at last valid state', async () => {
    const { store, globalDirectory } = await setupTest({
      watch: true,
      globalConfig: { host: '0.0.0.0', retries: 3 },
      projectConfig: { port: 3000 },
      onDebug: () => {},
    });

    expect(store!.config).toEqual({
      port: 3000,
      host: '0.0.0.0',
      retries: 3,
    });

    const globalPath = path.resolve(globalDirectory, 'myapp.config.json');
    await rm(globalPath, { force: true });

    // Give the watcher time to fire — config should NOT change.
    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(store!.config).toEqual({
      port: 3000,
      host: '0.0.0.0',
      retries: 3,
    });

    await store!.stop();
  });
});
