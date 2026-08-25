import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('events-types — event type verification', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('scalar added: event.type = added, next = value, prev = undefined', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    const events: { type: string; next: unknown; prev: unknown }[] = [];
    store!.on('host', (event) => {
      events.push({ type: event.type, next: event.next, prev: event.prev });
    });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      host: 'localhost',
    });
    await waitForRemerge(store!, (config) => config['host'] === 'localhost');

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: 'added',
      next: 'localhost',
      prev: undefined,
    });

    await store!.stop();
  });

  it('scalar modified: event.type = modified, next = newValue, prev = oldValue', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    const events: { type: string; next: unknown; prev: unknown }[] = [];
    store!.on('port', (event) => {
      events.push({ type: event.type, next: event.next, prev: event.prev });
    });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(store!, (config) => config['port'] === 8080);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: 'modified',
      next: 8080,
      prev: 3000,
    });

    await store!.stop();
  });

  it('scalar removed: event.type = removed, next = undefined, prev = oldValue', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000, host: 'localhost' },
      createGlobalDir: true,
    });

    const events: { type: string; next: unknown; prev: unknown }[] = [];
    store!.on('host', (event) => {
      events.push({ type: event.type, next: event.next, prev: event.prev });
    });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });
    await waitForRemerge(store!, (config) => config['host'] === undefined);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: 'removed',
      next: undefined,
      prev: 'localhost',
    });

    await store!.stop();
  });

  it('array modified: event.type = modified, atomic replacement, no per-index diff', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { tags: ['a', 'b'] },
      createGlobalDir: true,
    });

    const events: { type: string; keyPath: string }[] = [];
    store!.on('tags', (event) => {
      events.push({ type: event.type, keyPath: event.keyPath });
    });
    store!.on('tags.0', (event) => {
      events.push({ type: event.type, keyPath: event.keyPath });
    });
    store!.on('tags.1', (event) => {
      events.push({ type: event.type, keyPath: event.keyPath });
    });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      tags: ['x', 'y'],
    });
    await waitForRemerge(
      store!,
      (config) => (config['tags'] as unknown[])[0] === 'x',
    );

    const parentEvent = events.find((event) => event.keyPath === 'tags');
    expect(parentEvent).toBeDefined();
    expect(parentEvent!.type).toBe('modified');

    const indexEvents = events.filter(
      (event) => event.keyPath === 'tags.0' || event.keyPath === 'tags.1',
    );
    expect(indexEvents).toHaveLength(0);

    await store!.stop();
  });
});
