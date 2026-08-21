import { clearWatcherRegistry, setupTest } from '@oclio/morsel-e2e-helpers';

describe('stop-idempotent — stop() x2 is a no-op', () => {
  clearWatcherRegistry();

  it('second stop() call resolves without error', async () => {
    const { store } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    await store!.stop();
    await expect(store!.stop()).resolves.toBeUndefined();
  });
});
