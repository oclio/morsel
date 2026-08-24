import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('watch-scalar-to-array — {a:1} → {a:[1,2]}', () => {
  clearWatcherRegistry();

  it('emits a modified with prev:1, next:[1,2], no per-index diff', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { a: 1 },
      createGlobalDir: true,
    });

    const events: { next: unknown; prev: unknown }[] = [];
    store!.on('a', (event) => {
      events.push({ next: event.next, prev: event.prev });
    });

    await writeConfig(projectDirectory, 'myapp.config.json', { a: [1, 2] });
    await waitForRemerge(store!, (config) =>
      Array.isArray((config as Record<string, unknown>)['a']),
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ next: [1, 2], prev: 1 });

    await store!.stop();
  });
});
