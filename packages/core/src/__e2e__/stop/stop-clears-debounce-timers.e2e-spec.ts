import {
  clearWatcherRegistry,
  setupTest,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('stop-clears-debounce-timers — no deferred re-merge after stop()', () => {
  clearWatcherRegistry();

  it('stop() clears debounce timers, no re-merge fires after stop', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    const configBeforeStop = { ...store!.config };

    await store!.stop();

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 9999,
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(store!.config).toEqual(configBeforeStop);
  });
});
