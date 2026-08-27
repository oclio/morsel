import {
  clearWatcherRegistry,
  setupTest,
  suppressConsoleError,
} from '@oclio/morsel-test-helpers';

describe('array-ops-shift — shift()', () => {
  suppressConsoleError();

  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('shift removes first element and returns its value', async () => {
    const { store } = await setupTest({
      projectConfig: { tags: ['a', 'b', 'c'] },
      watch: true,
    });

    const removed = await store!.shift('tags');

    expect(removed).toBe('a');
    expect(store!.get('tags')).toEqual(['b', 'c']);

    await store!.stop();
  });

  it('shift on empty array returns undefined', async () => {
    const { store } = await setupTest({
      projectConfig: { tags: [] },
      watch: true,
    });

    const removed = await store!.shift('tags');

    expect(removed).toBeUndefined();
    expect(store!.get('tags')).toEqual([]);

    await store!.stop();
  });

  it('shift on non-array key throws MorselError(EVALIDATE)', async () => {
    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
    });

    await expect(store!.shift('port')).rejects.toMatchObject({
      name: 'MorselError',
      code: 'EVALIDATE',
    });

    await store!.stop();
  });
});
