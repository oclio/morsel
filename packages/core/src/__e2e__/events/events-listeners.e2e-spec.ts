import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/test-helpers';

describe('events-listeners — listener management', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('dotted key listener fires when nested scalar changes', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { tools: { eslint: true, prettier: true } },
      createGlobalDir: true,
    });

    const events: { next: unknown; prev: unknown }[] = [];
    store!.on('tools.eslint', (event) => {
      events.push({ next: event.next, prev: event.prev });
    });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      tools: { eslint: false, prettier: true },
    });
    await waitForRemerge(store!, (config) => {
      const tools = config['tools'] as Record<string, unknown> | undefined;
      return tools?.['eslint'] === false;
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ next: false, prev: true });

    await store!.stop();
  });

  it('multiple listeners on same key all fire on change', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    let calls1 = 0;
    let calls2 = 0;
    store!.on('port', () => {
      calls1++;
    });
    store!.on('port', () => {
      calls2++;
    });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(store!, (config) => config['port'] === 8080);

    expect(calls1).toBe(1);
    expect(calls2).toBe(1);

    await store!.stop();
  });

  it('calling unsubscribe stops further events', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    let calls = 0;
    const unsub = store!.on('port', () => {
      calls++;
    });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3001 });
    await waitForRemerge(store!, (config) => config['port'] === 3001);

    expect(calls).toBe(1);

    unsub();

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3002 });
    await waitForRemerge(store!, (config) => config['port'] === 3002);

    expect(calls).toBe(1);

    await store!.stop();
  });

  it('unsubscribe on wildcard listener stops further wildcard events', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { server: { host: 'localhost', port: 3000 } },
      createGlobalDir: true,
    });

    let calls = 0;
    const unsub = store!.on('server.*', () => {
      calls++;
    });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      server: { host: '0.0.0.0', port: 3000 },
    });
    await waitForRemerge(
      store!,
      (config) =>
        (config['server'] as Record<string, unknown>)['host'] === '0.0.0.0',
    );

    expect(calls).toBe(1);

    unsub();

    await writeConfig(projectDirectory, 'myapp.config.json', {
      server: { host: '1.1.1.1', port: 3000 },
    });
    await waitForRemerge(
      store!,
      (config) =>
        (config['server'] as Record<string, unknown>)['host'] === '1.1.1.1',
    );

    expect(calls).toBe(1);

    await store!.stop();
  });

  it('calling on() after stop() throws Error', async () => {
    const { store } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    await store!.stop();

    expect(() => store!.on('port', () => {})).toThrow(
      'morsel: store is stopped',
    );
  });

  it('after stop(), subsequent file changes do not emit events', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    let calls = 0;
    store!.on('port', () => {
      calls++;
    });

    await store!.stop();

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });

    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(calls).toBe(0);
  });
});
