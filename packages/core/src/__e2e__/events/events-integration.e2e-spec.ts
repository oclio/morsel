import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/test-helpers';

describe('events-integration — events from pipeline sources', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('events when hook modifies config', async () => {
    let hookValue = 'initial';
    const hooks = [
      {
        name: 'add-key',
        lifecycle: 'before:defaults',
        load: () => ({ extra: hookValue }),
      },
    ] as const;

    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      hooks,
    });

    const events: { keyPath: string; type: string }[] = [];
    store!.on('extra', (event) => {
      events.push({ keyPath: event.keyPath, type: event.type });
    });

    hookValue = 'updated';
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(
      store!,
      (config) => config['extra'] === 'updated',
      10_000,
    );

    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]!.type).toBe('modified');

    await store!.stop();
  });

  it('events when validation transforms config', async () => {
    let validatedValue = 'initial';
    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      validationPlugins: [
        {
          name: 'add-defaults',
          validate: (config) => ({ ...config, validated: validatedValue }),
        },
      ],
    });

    const events: { keyPath: string; type: string }[] = [];
    store!.on('validated', (event) => {
      events.push({ keyPath: event.keyPath, type: event.type });
    });

    validatedValue = 'updated';
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(
      store!,
      (config) => config['validated'] === 'updated',
      10_000,
    );

    expect(events.length).toBeGreaterThanOrEqual(1);

    await store!.stop();
  });

  it('events when extends added during watch', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    await writeConfig(projectDirectory, 'base.json', { host: 'localhost' });

    const events: { keyPath: string; type: string }[] = [];
    store!.on('host', (event) => {
      events.push({ keyPath: event.keyPath, type: event.type });
    });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      extends: './base.json',
    });
    await waitForRemerge(
      store!,
      (config) => config['host'] === 'localhost',
      10_000,
    );

    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('added');

    await store!.stop();
  });

  it('events when $env changes during watch (envName fixed)', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000, $env: { ci: { port: 8080 } } },
      createGlobalDir: true,
      envName: 'ci',
    });

    const events: { keyPath: string; type: string }[] = [];
    store!.on('port', (event) => {
      events.push({ keyPath: event.keyPath, type: event.type });
    });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      $env: { ci: { port: 9090 } },
    });
    await waitForRemerge(store!, (config) => config['port'] === 9090, 10_000);

    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('modified');

    await store!.stop();
  });

  it('events with prev === next (no-op): no event emitted', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    let calls = 0;
    store!.on('port', () => {
      calls++;
    });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(calls).toBe(0);

    await store!.stop();
  });

  it('events during pending re-merge', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    let calls = 0;
    store!.on('port', () => {
      calls++;
    });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3001 });
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3002 });
    await waitForRemerge(store!, (config) => config['port'] === 3002, 10_000);

    expect(calls).toBeGreaterThanOrEqual(1);

    await store!.stop();
  });

  it('events when multiple files change simultaneously (global + project)', async () => {
    const { store, projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      globalConfig: { host: 'localhost' },
    });

    const portEvents: string[] = [];
    const hostEvents: string[] = [];
    store!.on('port', () => {
      portEvents.push('port');
    });
    store!.on('host', () => {
      hostEvents.push('host');
    });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await writeConfig(globalDirectory, 'myapp.config.json', {
      host: '0.0.0.0',
    });
    await waitForRemerge(
      store!,
      (config) => config['port'] === 8080 && config['host'] === '0.0.0.0',
      10_000,
    );

    expect(portEvents.length).toBeGreaterThanOrEqual(1);
    expect(hostEvents.length).toBeGreaterThanOrEqual(1);

    await store!.stop();
  });
});
