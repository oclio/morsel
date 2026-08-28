import {
  clearWatcherRegistry,
  setupTest,
  suppressConsoleError,
  writeConfig,
} from '@oclio/test-helpers';

describe('boot-watch — watchConfig specifics', () => {
  suppressConsoleError();

  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('watchConfig returns store with all methods', async () => {
    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
    });

    expect(typeof store!.on).toBe('function');
    expect(typeof store!.get).toBe('function');
    expect(typeof store!.has).toBe('function');
    expect(typeof store!.all).toBe('function');
    expect(typeof store!.dotify).toBe('function');
    expect(typeof store!.indexOf).toBe('function');
    expect(typeof store!.lastIndexOf).toBe('function');
    expect(typeof store!.getProvenance).toBe('function');
    expect(typeof store!.stop).toBe('function');

    await store!.stop();
  });

  it('watchConfig accepts watchDebounce option at boot', async () => {
    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      watchDebounce: 100,
    });

    expect(store!.config).toEqual({ port: 3000 });

    await store!.stop();
  });

  it('watchConfig with projectPath undefined → store boots, no project directory watched', async () => {
    const { store } = await setupTest({
      globalConfig: { port: 3000 },
      watch: true,
    });

    expect(store!.config).toEqual({ port: 3000 });

    await store!.stop();
  });

  it('watchConfig with globalPath undefined → store boots, no global directory watched', async () => {
    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      skipGlobalDirectory: true,
    });

    expect(store!.config).toEqual({ port: 3000 });

    await store!.stop();
  });

  it('AbortSignal already aborted → stop() called after hook init', async () => {
    const controller = new AbortController();
    controller.abort();

    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      signal: controller.signal,
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(() => store!.on('port', () => {})).toThrow(
      'morsel: store is stopped',
    );
  });

  it('AbortSignal aborts after boot → stop() called', async () => {
    const controller = new AbortController();

    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      signal: controller.signal,
    });

    let isFired = false;
    store!.on('port', () => {
      isFired = true;
    });

    controller.abort();

    await new Promise((resolve) => setTimeout(resolve, 100));

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 9000 });

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(isFired).toBe(false);
  });

  it('AbortSignal already aborted AND hook init throws → EHOOK takes precedence', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      setupTest({
        projectConfig: { port: 3000 },
        watch: true,
        signal: controller.signal,
        hooks: [
          {
            name: 'failing',
            lifecycle: 'before:defaults',
            load: () => ({}),
            init: () => {
              throw new Error('hook init failed');
            },
          },
        ],
      } as never),
    ).rejects.toMatchObject({ name: 'MorselError', code: 'EHOOK' });
  });

  it('AbortSignal fires during initHooks → store stopped via signal.aborted check', async () => {
    const controller = new AbortController();

    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      signal: controller.signal,
      hooks: [
        {
          name: 'abort-during-init',
          lifecycle: 'before:defaults',
          load: () => ({}),
          init: () => {
            controller.abort();
          },
        },
      ],
    } as never);

    expect(() => store!.on('port', () => {})).toThrow('store is stopped');
  });
});
