import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('watch-array-to-scalar — {a:[1,2]} → {a:1}', () => {
  clearWatcherRegistry();

  it('emits a modified with prev:[1,2], next:1', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { a: [1, 2] },
      createGlobalDir: true,
    });

    const events: { next: unknown; prev: unknown }[] = [];
    store!.on('a', (next, prev) => {
      events.push({ next, prev });
    });

    await writeConfig(projectDirectory, 'myapp.config.json', { a: 1 });
    await waitForRemerge(
      store!,
      (config) => (config as Record<string, unknown>)['a'] === 1,
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ next: 1, prev: [1, 2] });

    await store!.stop();
  });
});
