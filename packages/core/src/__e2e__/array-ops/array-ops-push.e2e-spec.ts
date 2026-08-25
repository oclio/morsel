import { chmod } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('array-ops-push — push()', () => {
  let directory: string;
  let projectDirectory: string;
  let globalDirectory: string;

  beforeEach(async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    clearWatcherRegistry();
    const env = await createTemporaryEnvironment();
    directory = env.directory;
    projectDirectory = `${directory}/project`;
    globalDirectory = `${directory}/global`;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('push adds to end and returns new index (not length)', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      tags: ['a', 'b'],
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    const newIndex = await store.push('tags', 'c');

    expect(newIndex).toBe(2);
    expect(store.get('tags')).toEqual(['a', 'b', 'c']);

    await store.stop();
  });

  it('push emits on path.<newIndex> for new element with type added', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      tags: ['a'],
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    let capturedEvent: {
      keyPath: string;
      type: string;
      next: unknown;
      prev: unknown;
    } | null = null;

    store.on('tags.1', (event) => {
      capturedEvent = event;
    });

    await store.push('tags', 'b');

    expect(capturedEvent).not.toBeNull();
    expect(capturedEvent!.keyPath).toBe('tags.1');
    expect(capturedEvent!.type).toBe('added');
    expect(capturedEvent!.next).toBe('b');
    expect(capturedEvent!.prev).toBeUndefined();

    await store.stop();
  });

  it('push on non-array key throws MorselError(EVALIDATE)', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await expect(store.push('port', 'x')).rejects.toMatchObject({
      name: 'MorselError',
      code: 'EVALIDATE',
    });

    await store.stop();
  });

  it('push on missing key throws MorselError(EVALIDATE)', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await expect(store.push('missing', 'x')).rejects.toMatchObject({
      name: 'MorselError',
      code: 'EVALIDATE',
    });

    await store.stop();
  });

  it('push triggers after:write hook with keyPath and mutation', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      tags: ['a'],
    });

    let writeEvent: {
      filePath: string;
      keyPath: string;
      mutation: unknown;
    } | null = null;

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
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

    await store.push('tags', 'b');

    expect(writeEvent).not.toBeNull();
    expect(writeEvent!.keyPath).toBe('tags');
    expect(writeEvent!.filePath).toBe(
      path.resolve(projectDirectory, 'myapp.config.json'),
    );
    expect(writeEvent!.mutation).toMatchObject({
      path: 'tags',
      value: ['a', 'b'],
    });

    await store.stop();
  });

  it('push rollback on write failure restores previous config', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      tags: ['a', 'b'],
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await chmod(projectDirectory, 0o555);

    await expect(store.push('tags', 'c')).rejects.toMatchObject({
      name: 'WriteError',
      code: 'EWRITE',
    });

    expect(store.get('tags')).toEqual(['a', 'b']);

    await chmod(projectDirectory, 0o755);
    await store.stop();
  });

  it('push array modified event: atomic replacement, no per-index diff', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      tags: ['a', 'b'],
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    const events: { keyPath: string; type: string }[] = [];

    store.on('tags', (event) => {
      events.push({ keyPath: event.keyPath, type: event.type });
    });
    store.on('tags.0', (event) => {
      events.push({ keyPath: event.keyPath, type: event.type });
    });
    store.on('tags.1', (event) => {
      events.push({ keyPath: event.keyPath, type: event.type });
    });
    store.on('tags.2', (event) => {
      events.push({ keyPath: event.keyPath, type: event.type });
    });

    await store.push('tags', 'c');

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

    await store.stop();
  });
});
