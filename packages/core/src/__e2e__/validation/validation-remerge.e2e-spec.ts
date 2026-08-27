import {
  clearWatcherRegistry,
  createDebugCollector,
  setupTest,
  suppressConsoleError,
  waitForDebugContext,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('validation-remerge — watch re-merge', () => {
  suppressConsoleError();

  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('remerge catch: validation fail on re-merge keeps config, onDebug notified', async () => {
    const { contexts: debugContexts, callback } = createDebugCollector();

    const validate = (config: Record<string, unknown>) => {
      if (typeof config['port'] !== 'number') {
        throw new TypeError('port must be a number');
      }
      return config;
    };

    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      createGlobalDir: true,
      validationPlugins: [{ name: 'port-type', validate }],
      onDebug: callback,
    } as never);

    expect(store!.config).toEqual({ port: 3000 });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 'not-a-number',
    });

    await waitForDebugContext(
      debugContexts,
      (context) => context['code'] === 'EVALIDATE',
    );

    expect(store!.config).toEqual({ port: 3000 });
    expect(
      debugContexts.some((context) => context['code'] === 'EVALIDATE'),
    ).toBe(true);

    await store!.stop();
  });

  it('remerge onDebug context has code: EVALIDATE', async () => {
    const { contexts: debugContexts, callback } = createDebugCollector();

    const validate = (config: Record<string, unknown>) => {
      if (config['port'] === 'invalid') {
        throw new Error('port must not be "invalid"');
      }
      return config;
    };

    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      createGlobalDir: true,
      validationPlugins: [{ name: 'port-type', validate }],
      onDebug: callback,
    } as never);

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 'invalid',
    });

    await waitForDebugContext(
      debugContexts,
      (context) => context['code'] === 'EVALIDATE',
    );

    const validationContext = debugContexts.find(
      (context) => context['code'] === 'EVALIDATE',
    );

    expect(validationContext).toBeDefined();
    expect(validationContext?.['code']).toBe('EVALIDATE');

    await store!.stop();
  });

  it('remerge recovery: validation fail then fix → config updates', async () => {
    const validationPlugin = {
      name: 'validator',
      validate: (config: Record<string, unknown>) => {
        if (typeof config['port'] !== 'number') {
          throw new TypeError('port must be a number');
        }
        return config;
      },
    };

    const { contexts, callback } = createDebugCollector();

    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      validationPlugins: [validationPlugin],
      onDebug: callback,
    } as never);

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 'not-a-number',
    });

    await waitForDebugContext(
      contexts,
      (context) => context['code'] === 'EVALIDATE',
    );

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 8080,
    });

    await waitForRemerge(
      store!,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    expect(store!.config).toEqual({ port: 8080 });

    await store!.stop();
  });
});
