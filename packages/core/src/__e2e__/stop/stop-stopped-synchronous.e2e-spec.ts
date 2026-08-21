import { clearWatcherRegistry, setupTest } from '@oclio/morsel-e2e-helpers';

describe('stop-stopped-synchronous — stopped flag set synchronously', () => {
  clearWatcherRegistry();

  it('second stop() sees stopped immediately (synchronous flag)', async () => {
    const { store } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    const stopPromise = store!.stop();

    await expect(store!.stop()).resolves.toBeUndefined();

    await stopPromise;
  });
});
