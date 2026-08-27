import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  suppressConsoleError,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('events-array-ops — array-specific events', () => {
  let directory: string;
  let projectDirectory: string;
  let globalDirectory: string;

  suppressConsoleError();

  beforeEach(async () => {
    clearWatcherRegistry();
    const env = await createTemporaryEnvironment();
    directory = env.directory;
    projectDirectory = `${directory}/project`;
    globalDirectory = `${directory}/global`;
  });

  it('push emits on path.<newIndex> for newly added element', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      tags: ['a'],
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    const events: { keyPath: string; type: string }[] = [];
    store.on('tags.1', (event) => {
      events.push({ keyPath: event.keyPath, type: event.type });
    });

    await store.push('tags', 'b');

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ keyPath: 'tags.1', type: 'added' });

    await store.stop();
  });

  it('push index listener fires only for exact key (no wildcard)', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      tags: ['a'],
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    let wildcardCalls = 0;
    store.on('tags.*', () => {
      wildcardCalls++;
    });

    await store.push('tags', 'b');

    expect(wildcardCalls).toBe(0);

    await store.stop();
  });

  it('array mutator type mismatch throws MorselError(EVALIDATE)', async () => {
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
});
