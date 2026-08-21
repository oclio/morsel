import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('watch-pending-remerge — fire during re-merge → pendingRemerge', () => {
  clearWatcherRegistry();

  it('re-launches re-merge after pending fire, no fire lost', async () => {
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

    expect(store!.config).toEqual({ port: 3000 });

    hookDelay = 200;
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3001 });
    await new Promise((resolve) => setTimeout(resolve, 100));
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3002 });

    await waitForRemerge(
      store!,
      (config) => (config as Record<string, unknown>)['port'] === 3002,
    );

    expect(store!.config).toEqual({ port: 3002 });

    await store!.stop();
  });
});
