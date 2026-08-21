import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('validation-remerge-catch — validation fail on re-merge keeps config', () => {
  clearWatcherRegistry();

  it('validation fail on re-merge keeps last valid config, onDebug notified', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });
    await mkdir(`${directory}/global`, { recursive: true });

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
      globalDir: `${directory}/global`,
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

    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(store.config).toEqual({ port: 3000 });
    expect(
      debugContexts.some((context) => context['code'] === 'EVALIDATE'),
    ).toBe(true);

    await store.stop();
  });
});
