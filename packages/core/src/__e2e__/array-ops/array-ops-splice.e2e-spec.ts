import {
  clearWatcherRegistry,
  setupTest,
  suppressConsoleError,
} from '@oclio/test-helpers';

describe('array-ops-splice — splice()', () => {
  suppressConsoleError();

  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('splice removes and returns removed elements', async () => {
    const { store } = await setupTest({
      projectConfig: { tags: ['a', 'b', 'c', 'd'] },
      watch: true,
    });

    const removed = await store!['splice']('tags', 1, 2);

    expect(removed).toEqual(['b', 'c']);
    expect(store!.get('tags')).toEqual(['a', 'd']);

    await store!.stop();
  });

  it('splice with negative start counts from end', async () => {
    const { store } = await setupTest({
      projectConfig: { tags: ['a', 'b', 'c', 'd'] },
      watch: true,
    });

    const removed = await store!['splice']('tags', -2, 1);

    expect(removed).toEqual(['c']);
    expect(store!.get('tags')).toEqual(['a', 'b', 'd']);

    await store!.stop();
  });

  it('splice with deleteCount > length removes up to end', async () => {
    const { store } = await setupTest({
      projectConfig: { tags: ['a', 'b'] },
      watch: true,
    });

    const removed = await store!['splice']('tags', 1, 10);

    expect(removed).toEqual(['b']);
    expect(store!.get('tags')).toEqual(['a']);

    await store!.stop();
  });

  it('splice on non-array key throws MorselError(EVALIDATE)', async () => {
    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
    });

    await expect(store!['splice']('port', 0, 1)).rejects.toMatchObject({
      name: 'MorselError',
      code: 'EVALIDATE',
    });

    await store!.stop();
  });

  it('splice with insert items inserts at start position', async () => {
    const { store } = await setupTest({
      projectConfig: { tags: ['a', 'b', 'c'] },
      watch: true,
    });

    const removed = await store!['splice']('tags', 1, 1, 'x', 'y');

    expect(removed).toEqual(['b']);
    expect(store!.get('tags')).toEqual(['a', 'x', 'y', 'c']);

    await store!.stop();
  });
});
