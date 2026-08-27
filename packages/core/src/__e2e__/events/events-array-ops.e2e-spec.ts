import {
  clearWatcherRegistry,
  setupTest,
  suppressConsoleError,
} from '@oclio/test-helpers';

describe('events-array-ops — array-specific events', () => {
  suppressConsoleError();

  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('push emits on path.<newIndex> for newly added element', async () => {
    const { store } = await setupTest({
      projectConfig: { tags: ['a'] },
      watch: true,
    });

    const events: { keyPath: string; type: string }[] = [];
    store!.on('tags.1', (event) => {
      events.push({ keyPath: event.keyPath, type: event.type });
    });

    await store!.push('tags', 'b');

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ keyPath: 'tags.1', type: 'added' });

    await store!.stop();
  });

  it('push index listener fires only for exact key (no wildcard)', async () => {
    const { store } = await setupTest({
      projectConfig: { tags: ['a'] },
      watch: true,
    });

    let wildcardCalls = 0;
    store!.on('tags.*', () => {
      wildcardCalls++;
    });

    await store!.push('tags', 'b');

    expect(wildcardCalls).toBe(0);

    await store!.stop();
  });

  it('array mutator type mismatch throws MorselError(EVALIDATE)', async () => {
    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
    });

    await expect(store!.push('port', 'x')).rejects.toMatchObject({
      name: 'MorselError',
      code: 'EVALIDATE',
    });

    await store!.stop();
  });
});
