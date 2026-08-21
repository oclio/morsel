import { clearWatcherRegistry } from '@oclio/morsel-e2e-helpers';

import { setupDeletedDirectoryScenario } from './_setup-deleted-directory';

describe('watcher-directory-deleted — rm -rf watched dir → crash, retry polling', () => {
  clearWatcherRegistry();

  it('deleting watched directory does not crash the process, config stays frozen', async () => {
    const { store } = await setupDeletedDirectoryScenario();

    expect(store.config).toEqual({ port: 3000 });

    await store.stop();
  });
});
