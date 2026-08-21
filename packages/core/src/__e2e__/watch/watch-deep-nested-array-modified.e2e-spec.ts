import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('watch-deep-nested-array-modified — deep array element change', () => {
  clearWatcherRegistry();

  it('emits on parent only, no diff by index or child key', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { items: [{ name: 'a' }, { name: 'b' }] },
      createGlobalDir: true,
    });

    const events: { next: unknown; prev: unknown }[] = [];
    store!.on('items', (next, prev) => {
      events.push({ next, prev });
    });
    store!.on('items.0.name', () => {
      events.push({ next: 'should-not-fire', prev: undefined });
    });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      items: [{ name: 'x' }, { name: 'b' }],
    });
    await waitForRemerge(store!, (config) => {
      const items = (config as Record<string, unknown>)['items'] as
        { name: string }[] | undefined;
      return items?.[0]?.['name'] === 'x';
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      next: [{ name: 'x' }, { name: 'b' }],
      prev: [{ name: 'a' }, { name: 'b' }],
    });

    await store!.stop();
  });
});
