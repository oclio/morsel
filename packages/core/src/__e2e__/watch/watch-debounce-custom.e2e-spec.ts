import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('watch-debounce-custom — watchDebounce: 100 → faster re-merge', () => {
  clearWatcherRegistry();

  it('re-merges within ~100ms with custom debounce', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      watchDebounce: 100,
    });

    const start = Date.now();

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(
      store!,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(250);

    await store!.stop();
  });
});
