import {
  clearWatcherRegistry,
  setupTest,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('watch-rollback-on-validation-error — validation fail keeps config', () => {
  clearWatcherRegistry();

  it('editing to invalid config keeps last valid config, onDebug notified with EVALIDATE', async () => {
    const debugContexts: Record<string, unknown>[] = [];

    const validate = (config: Record<string, unknown>) => {
      if (config['port'] !== undefined && typeof config['port'] !== 'number') {
        throw new Error('port must be a number');
      }
      return config;
    };

    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      validationPlugins: [{ name: 'port-type', validate }],
      onDebug: (_message: string, context?: Record<string, unknown>) => {
        if (context) {
          debugContexts.push(context);
        }
      },
    });

    expect(store!.config).toEqual({ port: 3000 });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 'not-a-number',
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(store!.config).toEqual({ port: 3000 });
    expect(
      debugContexts.some((context) => context['code'] === 'EVALIDATE'),
    ).toBe(true);

    await store!.stop();
  });
});
