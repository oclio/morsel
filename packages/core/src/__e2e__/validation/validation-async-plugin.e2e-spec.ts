import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('validation-async-plugin — validation plugin in async loadConfig', () => {
  clearWatcherRegistry();

  it('validation plugin result is applied in async loadConfig', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await mkdir(projectDirectory, { recursive: true });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    const validationPlugin = {
      name: 'validator',
      validate: (config: Record<string, unknown>) => {
        return { ...config, validated: true };
      },
    };

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      validationPlugins: [validationPlugin],
    });

    expect(config).toEqual({ port: 3000, validated: true });
  });
});
