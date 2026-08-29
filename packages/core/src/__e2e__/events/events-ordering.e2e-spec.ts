import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/test-helpers';

describe('events-ordering — two-phase ordering', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('removals fire deepest-first, additions fire shallowest-first', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { a: { b: 1, c: 2 } },
      createGlobalDir: true,
    });

    const callOrder: string[] = [];
    store!.on('a', () => {
      callOrder.push('a');
    });
    store!.on('a.b', () => {
      callOrder.push('a.b');
    });
    store!.on('a.c', () => {
      callOrder.push('a.c');
    });
    store!.on('a.d', () => {
      callOrder.push('a.d');
    });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      a: { d: 3 },
    });
    await waitForRemerge(store!, (config) => {
      const a = config['a'] as Record<string, unknown> | undefined;
      return a?.['d'] === 3;
    });

    const removals = callOrder.filter((k) => k === 'a.b' || k === 'a.c');
    const additions = callOrder.filter((k) => k === 'a.d');

    expect(removals).toContain('a.b');
    expect(removals).toContain('a.c');
    expect(additions).toContain('a.d');

    const firstRemovalIndex = Math.min(
      callOrder.indexOf('a.b'),
      callOrder.indexOf('a.c'),
    );
    const additionDIndex = callOrder.indexOf('a.d');
    expect(firstRemovalIndex).toBeLessThan(additionDIndex);

    await store!.stop();
  });

  it('same depth: removals descending alpha, additions ascending alpha', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { a: { b: 1, c: 2 } },
      createGlobalDir: true,
    });

    const callOrder: string[] = [];
    store!.on('a.b', () => {
      callOrder.push('a.b');
    });
    store!.on('a.c', () => {
      callOrder.push('a.c');
    });

    await writeConfig(projectDirectory, 'myapp.config.json', {});
    await waitForRemerge(store!, (config) => config['a'] === undefined);

    expect(callOrder).toEqual(['a.c', 'a.b']);

    await store!.stop();
  });

  it('object to object recursive descent: all modified child scalars emitted', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { server: { host: 'localhost', port: 3000 } },
      createGlobalDir: true,
    });

    const fired: string[] = [];
    store!.on('server', () => {
      fired.push('server');
    });
    store!.on('server.host', () => {
      fired.push('server.host');
    });
    store!.on('server.port', () => {
      fired.push('server.port');
    });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      server: { host: '0.0.0.0', port: 8080 },
    });
    await waitForRemerge(
      store!,
      (config) =>
        (config['server'] as Record<string, unknown>)['port'] === 8080,
    );

    expect(fired).toContain('server.host');
    expect(fired).toContain('server.port');

    await store!.stop();
  });

  it('object replaced by scalar: parent modified + all child scalars as removed', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { server: { host: 'localhost', port: 3000 } },
      createGlobalDir: true,
    });

    const events: { key: string; type: string }[] = [];
    store!.on('server', (event) => {
      events.push({ key: 'server', type: event.type });
    });
    store!.on('server.host', (event) => {
      events.push({ key: 'server.host', type: event.type });
    });
    store!.on('server.port', (event) => {
      events.push({ key: 'server.port', type: event.type });
    });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      server: 'disabled',
    });
    await waitForRemerge(store!, (config) => config['server'] === 'disabled');

    const serverEvent = events.find((event) => event.key === 'server');
    expect(serverEvent!.type).toBe('modified');

    const hostEvent = events.find((event) => event.key === 'server.host');
    expect(hostEvent!.type).toBe('removed');

    const portEvent = events.find((event) => event.key === 'server.port');
    expect(portEvent!.type).toBe('removed');

    await store!.stop();
  });

  it('scalar replaced by object: parent modified + all child scalars as added', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { server: 'disabled' },
      createGlobalDir: true,
    });

    const events: { key: string; type: string }[] = [];
    store!.on('server', (event) => {
      events.push({ key: 'server', type: event.type });
    });
    store!.on('server.host', (event) => {
      events.push({ key: 'server.host', type: event.type });
    });
    store!.on('server.port', (event) => {
      events.push({ key: 'server.port', type: event.type });
    });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      server: { host: 'localhost', port: 3000 },
    });
    await waitForRemerge(
      store!,
      (config) => typeof config['server'] === 'object',
    );

    const serverEvent = events.find((event) => event.key === 'server');
    expect(serverEvent!.type).toBe('modified');

    const hostEvent = events.find((event) => event.key === 'server.host');
    expect(hostEvent!.type).toBe('added');

    const portEvent = events.find((event) => event.key === 'server.port');
    expect(portEvent!.type).toBe('added');

    await store!.stop();
  });

  it('object added: parent + all child scalars emitted as added', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    const events: { key: string; type: string }[] = [];
    store!.on('server', (event) => {
      events.push({ key: 'server', type: event.type });
    });
    store!.on('server.host', (event) => {
      events.push({ key: 'server.host', type: event.type });
    });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      server: { host: 'localhost' },
    });
    await waitForRemerge(store!, (config) => config['server'] !== undefined);

    const serverEvent = events.find((event) => event.key === 'server');
    expect(serverEvent!.type).toBe('added');

    const hostEvent = events.find((event) => event.key === 'server.host');
    expect(hostEvent!.type).toBe('added');

    await store!.stop();
  });
});
