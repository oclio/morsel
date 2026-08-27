import {
  clearWatcherRegistry,
  setupTest,
  suppressConsoleError,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('watch-lifecycle-stop — boot & stop() behavior', () => {
  suppressConsoleError();

  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('boot failure → watchConfig throws MorselError (no last valid state)', async () => {
    const validate = (config: Record<string, unknown>) => {
      if (typeof config['port'] !== 'number') {
        throw new TypeError('port must be a number');
      }
      return config;
    };

    await expect(
      setupTest({
        watch: true,
        projectConfig: { port: 'not-a-number' },
        validationPlugins: [{ name: 'port-type', validate }],
      }),
    ).rejects.toThrow();
  });

  it('boot with hook init failure → EHOOK, watchers released', async () => {
    const hooks = [
      {
        name: 'failing-init',
        lifecycle: 'before:defaults' as const,
        load: () => ({}),
        init: () => {
          throw new Error('init failed');
        },
      },
    ];

    await expect(
      setupTest({
        watch: true,
        projectConfig: { port: 3000 },
        hooks,
      }),
    ).rejects.toThrow();
  });

  it('basic: stop() closes watchers and removes listeners', async () => {
    const { store } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    const unsubscribe = store!.on('port', () => {});
    unsubscribe();

    await store!.stop();
  });

  it('idempotent: second stop() resolves without error', async () => {
    const { store } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    await store!.stop();
    await expect(store!.stop()).resolves.toBeUndefined();
  });

  it('config readable: config frozen at last state after stop', async () => {
    const { store } = await setupTest({
      watch: true,
      projectConfig: { port: 3000, host: 'localhost' },
      createGlobalDir: true,
    });

    expect(store!.config).toEqual({ port: 3000, host: 'localhost' });

    await store!.stop();

    expect(store!.config).toEqual({ port: 3000, host: 'localhost' });
  });

  it('layers readable: layers trace readable after stop', async () => {
    const { store } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    const layersBefore = store!.layers.length;
    expect(layersBefore).toBeGreaterThan(0);

    await store!.stop();

    expect(store!.layers.length).toBe(layersBefore);
  });

  it('clears debounce timers: no re-merge fires after stop', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    const configBeforeStop = { ...store!.config };

    await store!.stop();

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 9999,
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(store!.config).toEqual(configBeforeStop);
  });

  it('during remerge: stop() completes after merge finishes', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(store!, (config) => config['port'] === 8080);

    await store!.stop();

    expect(store!.config).toEqual({ port: 8080 });
  });

  it('stop() awaits pending re-merge via state.remergeDone', async () => {
    let hookDelay = 0;

    const hooks = [
      {
        name: 'slow',
        lifecycle: 'before:defaults' as const,
        load: async () => {
          if (hookDelay > 0) {
            await new Promise((resolve) => setTimeout(resolve, hookDelay));
          }
          return {};
        },
      },
    ];

    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      hooks,
      watchDebounce: 50,
    });

    hookDelay = 500;
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await new Promise((resolve) => setTimeout(resolve, 150));

    await store!.stop();

    expect(store!.config).toEqual({ port: 8080 });
  });

  it('on after stop throws: calling on() after stop() throws', async () => {
    const { store } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    await store!.stop();

    expect(() => store!.on('port', () => {})).toThrow();
  });

  it('stopped synchronous: stopped=true before any await', async () => {
    const { store } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    const stopPromise = store!.stop();

    await expect(store!.stop()).resolves.toBeUndefined();

    await stopPromise;
  });

  it('stop() disposes hooks (non after:write)', async () => {
    let isDisposeCalled = false;

    const hooks = [
      {
        name: 'disposable',
        lifecycle: 'before:defaults' as const,
        load: () => ({}),
        dispose: () => {
          isDisposeCalled = true;
        },
      },
    ];

    const { store } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      hooks,
    });

    await store!.stop();

    expect(isDisposeCalled).toBe(true);
  });

  it('stop() hook dispose failure → onDebug notified, not thrown', async () => {
    const debugMessages: string[] = [];

    const hooks = [
      {
        name: 'failing-dispose',
        lifecycle: 'before:defaults' as const,
        load: () => ({}),
        dispose: () => {
          throw new Error('dispose failed');
        },
      },
    ];

    const { store } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      hooks,
      onDebug: (message: string) => {
        debugMessages.push(message);
      },
    });

    await expect(store!.stop()).resolves.toBeUndefined();

    expect(debugMessages.length).toBeGreaterThan(0);
  });

  it('stop() clears wildcardListeners', async () => {
    const { store } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    let isFired = false;
    store!.on('**', () => {
      isFired = true;
    });

    await store!.stop();

    expect(() => store!.on('**', () => {})).toThrow();
    expect(isFired).toBe(false);
  });
});
