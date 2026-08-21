import { clearWatcherRegistry, setupTest } from '@oclio/morsel-e2e-helpers';

describe('stop-config-readable — store.config readable after stop()', () => {
  clearWatcherRegistry();

  it('config is readable and frozen at last state after stop()', async () => {
    const { store } = await setupTest({
      watch: true,
      projectConfig: { port: 3000, host: 'localhost' },
      createGlobalDir: true,
    });

    expect(store!.config).toEqual({ port: 3000, host: 'localhost' });

    await store!.stop();

    expect(store!.config).toEqual({ port: 3000, host: 'localhost' });
  });
});
