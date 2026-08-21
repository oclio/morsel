import {
  clearWatcherRegistry,
  createDebugCollector,
  setupTest,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('error-evalidation-remerge — validation fail on re-merge, config kept', () => {
  clearWatcherRegistry();

  it('re-merge with validation failure → config preserved', async () => {
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

    expect(store!.config).toEqual({ port: 3000 });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 'not-a-number',
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(store!.config).toEqual({ port: 3000 });
    expect(contexts.some((context) => context['code'] === 'EVALIDATE')).toBe(
      true,
    );

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 8080,
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(store!.config).toEqual({ port: 8080 });

    await store!.stop();
  });
});
