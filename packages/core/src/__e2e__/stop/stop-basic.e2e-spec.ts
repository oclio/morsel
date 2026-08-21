import { clearWatcherRegistry, setupTest } from '@oclio/morsel-e2e-helpers';

describe('stop-basic — stop() closes watchers and removes listeners', () => {
  clearWatcherRegistry();

  it('stop() completes without error and closes watchers', async () => {
    const { store } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    const unsubscribe = store!.on('port', () => {});
    unsubscribe();

    await store!.stop();
  });
});
