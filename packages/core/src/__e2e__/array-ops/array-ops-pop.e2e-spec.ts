import {
  clearWatcherRegistry,
  setupTest,
  suppressConsoleError,
} from '@oclio/test-helpers';

describe('array-ops-pop — pop()', () => {
  suppressConsoleError();

  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('pop removes last element and returns its value', async () => {
    const { store } = await setupTest({
      projectConfig: { tags: ['a', 'b', 'c'] },
      watch: true,
    });

    const removed = await store!.pop('tags');

    expect(removed).toBe('c');
    expect(store!.get('tags')).toEqual(['a', 'b']);

    await store!.stop();
  });

  it('pop on empty array returns undefined', async () => {
    const { store } = await setupTest({
      projectConfig: { tags: [] },
      watch: true,
    });

    const removed = await store!.pop('tags');

    expect(removed).toBeUndefined();
    expect(store!.get('tags')).toEqual([]);

    await store!.stop();
  });

  it('pop on non-array key throws MorselError(EVALIDATE)', async () => {
    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
    });

    await expect(store!.pop('port')).rejects.toMatchObject({
      name: 'MorselError',
      code: 'EVALIDATE',
    });

    await store!.stop();
  });
});
