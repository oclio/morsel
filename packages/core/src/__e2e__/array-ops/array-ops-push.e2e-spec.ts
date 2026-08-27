import { chmod } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  setupTest,
  suppressConsoleError,
} from '@oclio/morsel-e2e-helpers';

describe('array-ops-push — push()', () => {
  suppressConsoleError();

  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('push adds to end and returns new index (not length)', async () => {
    const { store } = await setupTest({
      projectConfig: { tags: ['a', 'b'] },
      watch: true,
    });

    const newIndex = await store!.push('tags', 'c');

    expect(newIndex).toBe(2);
    expect(store!.get('tags')).toEqual(['a', 'b', 'c']);

    await store!.stop();
  });

  it('push emits on path.<newIndex> for new element with type added', async () => {
    const { store } = await setupTest({
      projectConfig: { tags: ['a'] },
      watch: true,
    });

    let capturedEvent: {
      keyPath: string;
      type: string;
      next: unknown;
      prev: unknown;
    } | null = null;

    store!.on('tags.1', (event) => {
      capturedEvent = event;
    });

    await store!.push('tags', 'b');

    expect(capturedEvent).not.toBeNull();
    expect(capturedEvent!.keyPath).toBe('tags.1');
    expect(capturedEvent!.type).toBe('added');
    expect(capturedEvent!.next).toBe('b');
    expect(capturedEvent!.prev).toBeUndefined();

    await store!.stop();
  });

  it('push on non-array key throws MorselError(EVALIDATE)', async () => {
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

  it('push on missing key throws MorselError(EVALIDATE)', async () => {
    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
    });

    await expect(store!.push('missing', 'x')).rejects.toMatchObject({
      name: 'MorselError',
      code: 'EVALIDATE',
    });

    await store!.stop();
  });

  it('push triggers after:write hook with keyPath and mutation', async () => {
    let writeEvent: {
      filePath: string;
      keyPath: string;
      mutation: unknown;
    } | null = null;

    const { store, projectDirectory } = await setupTest({
      projectConfig: { tags: ['a'] },
      watch: true,
      hooks: [
        {
          name: 'write-logger',
          lifecycle: 'after:write',
          onWrite: (event: {
            filePath: string;
            keyPath: string;
            mutation: unknown;
          }) => {
            writeEvent = event;
          },
        },
      ],
    } as never);

    await store!.push('tags', 'b');

    expect(writeEvent).not.toBeNull();
    expect(writeEvent!.keyPath).toBe('tags');
    expect(writeEvent!.filePath).toBe(
      path.resolve(projectDirectory, 'myapp.config.json'),
    );
    expect(writeEvent!.mutation).toMatchObject({
      path: 'tags',
      value: ['a', 'b'],
    });

    await store!.stop();
  });

  it('push rollback on write failure restores previous config', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { tags: ['a', 'b'] },
      watch: true,
    });

    await chmod(projectDirectory, 0o555);

    await expect(store!.push('tags', 'c')).rejects.toMatchObject({
      name: 'WriteError',
      code: 'EWRITE',
    });

    expect(store!.get('tags')).toEqual(['a', 'b']);

    await chmod(projectDirectory, 0o755);
    await store!.stop();
  });

  it('push array modified event: atomic replacement, no per-index diff', async () => {
    const { store } = await setupTest({
      projectConfig: { tags: ['a', 'b'] },
      watch: true,
    });

    const events: { keyPath: string; type: string }[] = [];

    store!.on('tags', (event) => {
      events.push({ keyPath: event.keyPath, type: event.type });
    });
    store!.on('tags.0', (event) => {
      events.push({ keyPath: event.keyPath, type: event.type });
    });
    store!.on('tags.1', (event) => {
      events.push({ keyPath: event.keyPath, type: event.type });
    });
    store!.on('tags.2', (event) => {
      events.push({ keyPath: event.keyPath, type: event.type });
    });

    await store!.push('tags', 'c');

    const tagEvents = events.filter((event) =>
      event.keyPath.startsWith('tags'),
    );
    const parentEvent = tagEvents.find((event) => event.keyPath === 'tags');
    expect(parentEvent).toBeDefined();
    expect(parentEvent!.type).toBe('modified');

    const existingIndexEvents = tagEvents.filter(
      (event) => event.keyPath === 'tags.0' || event.keyPath === 'tags.1',
    );
    expect(existingIndexEvents).toEqual([]);

    const newIndexEvent = tagEvents.find((event) => event.keyPath === 'tags.2');
    expect(newIndexEvent).toBeDefined();
    expect(newIndexEvent!.type).toBe('added');

    await store!.stop();
  });
});
