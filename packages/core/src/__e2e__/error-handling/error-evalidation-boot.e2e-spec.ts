import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('error-evalidation-boot — validation fail at boot throws', () => {
  clearWatcherRegistry();

  it('ValidationError thrown with issues', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await mkdir(projectDirectory, { recursive: true });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 'not-a-number',
    });

    const validationPlugin = {
      name: 'validator',
      validate: (config: Record<string, unknown>) => {
        if (typeof config['port'] !== 'number') {
          throw new TypeError('port must be a number');
        }
        return config;
      },
    };

    await expect(
      loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: `${directory}/global`,
        validationPlugins: [validationPlugin],
      } as never),
    ).rejects.toMatchObject({
      name: 'ValidationError',
      code: 'EVALIDATE',
    });
  });
});
