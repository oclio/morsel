import {
  clearWatcherRegistry,
  createEventCollector,
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

    const { events, listener } = createEventCollector();
    store!.on('host', listener);

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      host: 'localhost',
    });
    await waitForRemerge(store!, (config) => config['host'] === 'localhost');

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      keyPath: 'host',
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

    const { events, listener } = createEventCollector();
    store!.on('port', listener);

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(store!, (config) => config['port'] === 8080);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      keyPath: 'port',
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

    const { events, listener } = createEventCollector();
    store!.on('host', listener);

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });
    await waitForRemerge(store!, (config) => config['host'] === undefined);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      keyPath: 'host',
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

    const { events, listener } = createEventCollector();
    store!.on('tags', listener);
    store!.on('tags.0', listener);
    store!.on('tags.1', listener);

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
