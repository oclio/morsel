import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('watch-array-replace-vs-concat — arrayMerge affects diff', () => {
  clearWatcherRegistry();

  it('concat merges arrays across layers, replace overwrites', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      globalConfig: { tags: ['a', 'b'] },
      projectConfig: { tags: ['c'] },
      arrayMerge: 'concat',
    });

    expect(store!.config).toEqual({ tags: ['a', 'b', 'c'] });

    const events: { next: unknown; prev: unknown }[] = [];
    store!.on('tags', (next, prev) => {
      events.push({ next, prev });
    });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      tags: ['c', 'd'],
    });
    await waitForRemerge(
      store!,
      (config) =>
        ((config as Record<string, unknown>)['tags'] as unknown[])?.length ===
        4,
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      next: ['a', 'b', 'c', 'd'],
      prev: ['a', 'b', 'c'],
    });

    await store!.stop();
  });
});
