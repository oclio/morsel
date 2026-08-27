import {
  clearWatcherRegistry,
  setupTest,
  suppressConsoleError,
} from '@oclio/morsel-test-helpers';

describe('watch-lifecycle-signal — AbortSignal integration', () => {
  suppressConsoleError();

  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('signal already aborted → stop() called immediately', async () => {
    const controller = new AbortController();
    controller.abort();

    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      signal: controller.signal,
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(() => store!.on('port', () => {})).toThrow();

    await store!.stop();
  });

  it('signal aborts after boot → stop() called', async () => {
    const controller = new AbortController();

    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      signal: controller.signal,
    });

    expect(() => store!.on('port', () => {})).not.toThrow();

    controller.abort();

    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(() => store!.on('port', () => {})).toThrow();

    await store!.stop();
  });

  it('signal checked after hook init → abort during init stops store', async () => {
    const controller = new AbortController();

    const hooks = [
      {
        name: 'slow-init',
        lifecycle: 'before:defaults' as const,
        load: async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return {};
        },
      },
    ];

    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      signal: controller.signal,
      hooks,
    });

    controller.abort();

    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(() => store!.on('port', () => {})).toThrow();

    await store!.stop();
  });
});
