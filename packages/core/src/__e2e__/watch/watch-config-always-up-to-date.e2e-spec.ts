import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('watch-config-always-up-to-date — store.config is live getter', () => {
  clearWatcherRegistry();

  it('store.config reflects latest value after re-merge', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    expect(store!.config).toEqual({ port: 3000 });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(
      store!,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    expect(store!.config).toEqual({ port: 8080 });

    await store!.stop();
  });
});
