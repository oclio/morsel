import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('watch-create-global-file — boot without global file, then create it', () => {
  clearWatcherRegistry();

  it('creating global file triggers re-merge', async () => {
    const { store, globalDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    expect(store!.config).toEqual({ port: 3000 });

    await writeConfig(globalDirectory, 'myapp.config.json', {
      host: '0.0.0.0',
    });
    await waitForRemerge(
      store!,
      (config) => (config as Record<string, unknown>)['host'] === '0.0.0.0',
    );

    expect(store!.config).toEqual({ port: 3000, host: '0.0.0.0' });

    await store!.stop();
  });
});
