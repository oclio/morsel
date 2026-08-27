import {
  clearWatcherRegistry,
  setupTest,
  suppressConsoleError,
} from '@oclio/morsel-e2e-helpers';

describe('array-ops-indexof — indexOf/lastIndexOf (sync)', () => {
  suppressConsoleError();

  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('indexOf finds first matching index, -1 if absent', async () => {
    const { store } = await setupTest({
      projectConfig: { tags: ['a', 'b', 'a', 'c'] },
      watch: true,
    });

    expect(store!.indexOf('tags', 'a')).toBe(0);
    expect(store!.indexOf('tags', 'c')).toBe(3);
    expect(store!.indexOf('tags', 'z')).toBe(-1);

    await store!.stop();
  });

  it('lastIndexOf finds last matching index, -1 if absent', async () => {
    const { store } = await setupTest({
      projectConfig: { tags: ['a', 'b', 'a', 'c'] },
      watch: true,
    });

    expect(store!.lastIndexOf('tags', 'a')).toBe(2);
    expect(store!.lastIndexOf('tags', 'c')).toBe(3);
    expect(store!.lastIndexOf('tags', 'z')).toBe(-1);

    await store!.stop();
  });

  it('indexOf on non-array key throws MorselError(EVALIDATE)', async () => {
    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
    });

    expect(() => store!.indexOf('port', 3000)).toThrow(
      expect.objectContaining({ name: 'MorselError', code: 'EVALIDATE' }),
    );

    await store!.stop();
  });

  it('lastIndexOf on non-array key throws MorselError(EVALIDATE)', async () => {
    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
    });

    expect(() => store!.lastIndexOf('port', 3000)).toThrow(
      expect.objectContaining({ name: 'MorselError', code: 'EVALIDATE' }),
    );

    await store!.stop();
  });
});
