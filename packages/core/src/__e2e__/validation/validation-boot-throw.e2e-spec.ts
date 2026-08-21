import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('validation-boot-throw — validation fail at boot throws', () => {
  clearWatcherRegistry();

  it('throws MorselValidationError when plugin rejects config', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 'not-a-number',
    });

    const validate = (config: Record<string, unknown>) => {
      if (typeof config['port'] !== 'number') {
        throw new TypeError('port must be a number');
      }
      return config;
    };

    await expect(
      loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: `${directory}/global`,
        validationPlugins: [{ name: 'port-type', validate }],
      }),
    ).rejects.toMatchObject({
      name: 'MorselValidationError',
      code: 'EVALIDATE',
    });
  });
});
