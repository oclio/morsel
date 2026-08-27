import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createDebugCollector,
  createTemporaryEnvironment,
  setupTest,
  suppressConsoleError,
  waitForDebugContext,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('validation-remerge — watch re-merge', () => {
  let directory: string;
  let projectDirectory: string;
  let globalDirectory: string;

  suppressConsoleError();

  beforeEach(async () => {
    clearWatcherRegistry();
    const env = await createTemporaryEnvironment();
    directory = env.directory;
    projectDirectory = `${directory}/project`;
    globalDirectory = `${directory}/global`;
    await mkdir(projectDirectory, { recursive: true });
    await mkdir(globalDirectory, { recursive: true });
  });

  it('remerge catch: validation fail on re-merge keeps config, onDebug notified', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const debugContexts: Record<string, unknown>[] = [];

    const validate = (config: Record<string, unknown>) => {
      if (typeof config['port'] !== 'number') {
        throw new TypeError('port must be a number');
      }
      return config;
    };

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      validationPlugins: [{ name: 'port-type', validate }],
      onDebug: (_message: string, context?: Record<string, unknown>) => {
        if (context) {
          debugContexts.push(context);
        }
      },
    });

    expect(store.config).toEqual({ port: 3000 });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 'not-a-number',
    });

    await waitForDebugContext(
      debugContexts,
      (context) => context['code'] === 'EVALIDATE',
    );

    expect(store.config).toEqual({ port: 3000 });
    expect(
      debugContexts.some((context) => context['code'] === 'EVALIDATE'),
    ).toBe(true);

    await store.stop();
  });

  it('remerge onDebug context has code: EVALIDATE', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const debugContexts: Record<string, unknown>[] = [];

    const validate = (config: Record<string, unknown>) => {
      if (config['port'] === 'invalid') {
        throw new Error('port must not be "invalid"');
      }
      return config;
    };

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      validationPlugins: [{ name: 'port-type', validate }],
      onDebug: (_message: string, context?: Record<string, unknown>) => {
        if (context) {
          debugContexts.push(context);
        }
      },
    });

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

    await store.stop();
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
