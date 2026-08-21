import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('watch-array-modified — array change emits parent only', () => {
  clearWatcherRegistry();

  it('emits on parent key only, no per-index diff', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { tags: ['a', 'b'] },
      createGlobalDir: true,
    });

    const events: { next: unknown; prev: unknown }[] = [];
    store!.on('tags', (next, prev) => {
      events.push({ next, prev });
    });
    store!.on('tags.0', (next, prev) => {
      events.push({ next, prev });
    });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      tags: ['x', 'y', 'z'],
    });
    await waitForRemerge(
      store!,
      (config) =>
        ((config as Record<string, unknown>)['tags'] as unknown[])?.length ===
        3,
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ next: ['x', 'y', 'z'], prev: ['a', 'b'] });

    await store!.stop();
  });
});
