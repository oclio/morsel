import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('hooks-with-validation — hooks and validation in same pipeline', () => {
  clearWatcherRegistry();

  it('hook output is merged then validation runs on the result', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await mkdir(projectDirectory, { recursive: true });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    const hooks = [
      {
        name: 'app-hook',
        lifecycle: 'before:defaults' as const,
        load: () => ({ app: 'myapp' }),
      },
    ];

    const validationPlugin = {
      name: 'port-validator',
      validate: (config: Record<string, unknown>) => {
        if (typeof config['port'] !== 'number') {
          throw new TypeError('port must be a number');
        }
        return { ...config, validated: true };
      },
    };

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      hooks,
      validationPlugins: [validationPlugin],
    } as never);

    expect(config).toEqual({
      app: 'myapp',
      port: 3000,
      validated: true,
    });
  });
});
