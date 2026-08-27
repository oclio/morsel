import {
  clearWatcherRegistry,
  setupTest,
  suppressConsoleError,
} from '@oclio/morsel-e2e-helpers';

describe('array-ops-advanced — nested, target, stopped', () => {
  suppressConsoleError();

  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('array ops on nested array (items.0.tags)', async () => {
    const { store } = await setupTest({
      projectConfig: { items: [{ tags: ['x', 'y'] }] },
      watch: true,
    });

    const newIndex = await store!.push('items.0.tags', 'z');

    expect(newIndex).toBe(2);
    expect(store!.get('items.0.tags')).toEqual(['x', 'y', 'z']);

    await store!.stop();
  });

  it('array ops with target: global writes to global file', async () => {
    const { store } = await setupTest({
      globalConfig: { tags: ['a', 'b'] },
      projectConfig: { port: 3000 },
      watch: true,
    });

    await store!.push('tags', 'c', 'global');

    expect(store!.get('tags')).toEqual(['a', 'b', 'c']);

    await store!.stop();
  });

  it('array ops with target: project writes to project file', async () => {
    const { store } = await setupTest({
      globalConfig: { host: '0.0.0.0' },
      projectConfig: { tags: ['a', 'b'] },
      watch: true,
    });

    await store!.push('tags', 'c', 'project');

    expect(store!.get('tags')).toEqual(['a', 'b', 'c']);

    await store!.stop();
  });

  it('array ops on stopped store throws Error(store is stopped)', async () => {
    const { store } = await setupTest({
      projectConfig: { tags: ['a'] },
      watch: true,
    });

    await store!.stop();

    await expect(store!.push('tags', 'b')).rejects.toThrow('store is stopped');
  });
});
