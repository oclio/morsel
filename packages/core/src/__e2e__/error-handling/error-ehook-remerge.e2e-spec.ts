import {
  clearWatcherRegistry,
  createDebugCollector,
  setupTest,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('error-ehook-remerge — hook throw on re-merge, config kept', () => {
  clearWatcherRegistry();

  it('hook throws on re-merge → config preserved', async () => {
    let shouldThrow = false;

    const hooks = [
      {
        name: 'conditional',
        lifecycle: 'before:defaults' as const,
        load: () => {
          if (shouldThrow) {
            throw new TypeError('re-merge boom');
          }
          return {};
        },
      },
    ];

    const { contexts, callback } = createDebugCollector();

    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      hooks,
      onDebug: callback,
    } as never);

    expect(store!.config).toEqual({ port: 3000 });

    shouldThrow = true;
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(store!.config).toEqual({ port: 3000 });
    expect(contexts.some((context) => context['code'] === 'EHOOK')).toBe(true);

    shouldThrow = false;
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 9090 });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(store!.config).toEqual({ port: 9090 });

    await store!.stop();
  });
});
