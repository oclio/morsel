import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('stop-during-remerge — stop() during re-merge waits then closes', () => {
  clearWatcherRegistry();

  it('stop() during active re-merge completes after merge finishes', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(store!, (config) => config['port'] === 8080);

    await store!.stop();

    expect(store!.config).toEqual({ port: 8080 });
  });
});
