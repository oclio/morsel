import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('watch-debounce-default — 3 rapid writes < 300ms → 1 re-merge', () => {
  clearWatcherRegistry();

  it('coalesces rapid writes into a single re-merge', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    let remergeCount = 0;
    store!.on('port', () => {
      remergeCount++;
    });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3001 });
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3002 });
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3003 });

    await waitForRemerge(
      store!,
      (config) => (config as Record<string, unknown>)['port'] === 3003,
    );

    expect(remergeCount).toBe(1);

    await store!.stop();
  });
});
