import { clearWatcherRegistry, setupTest } from '@oclio/morsel-e2e-helpers';

describe('events-after-stop-throws — on() after stop() throws', () => {
  clearWatcherRegistry();

  it('calling on() after stop() throws Error', async () => {
    const { store } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    await store!.stop();

    expect(() => store!.on('port', () => {})).toThrow(
      'morsel: store is stopped',
    );
  });
});
