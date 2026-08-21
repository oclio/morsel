import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('watch-debounce-zero — watchDebounce: 0 triggers immediate re-merge', () => {
  clearWatcherRegistry();

  it('config updates after file change with zero debounce', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      watchDebounce: 0,
    });

    expect(store!.config).toEqual({ port: 3000 });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 8080,
    });

    await waitForRemerge(store!, (config) => config['port'] === 8080);

    expect(store!.config).toEqual({ port: 8080 });

    await store!.stop();
  });
});
