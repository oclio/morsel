import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('watch-simultaneous-global-and-project — both files change at once', () => {
  clearWatcherRegistry();

  it('both changes reflected after a single debounced re-merge', async () => {
    const { store, projectDirectory, globalDirectory } = await setupTest({
      watch: true,
      globalConfig: { host: '0.0.0.0' },
      projectConfig: { port: 3000 },
    });

    expect(store!.config).toEqual({ port: 3000, host: '0.0.0.0' });

    await writeConfig(globalDirectory, 'myapp.config.json', {
      host: '127.0.0.1',
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 8080,
    });

    await waitForRemerge(
      store!,
      (config) => config['port'] === 8080 && config['host'] === '127.0.0.1',
    );

    expect(store!.config).toEqual({ port: 8080, host: '127.0.0.1' });

    await store!.stop();
  });
});
