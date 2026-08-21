import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig, MorselValidationError } from '@/index';

describe('validation-morsel-error-passthrough — MorselValidationError rethrown as-is', () => {
  clearWatcherRegistry();

  it('plugin throws MorselValidationError → rethrown with issues preserved', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const validate = () => {
      throw new MorselValidationError({ port: 'must be between 1 and 65535' });
    };

    await expect(
      loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: `${directory}/global`,
        validationPlugins: [{ name: 'range', validate }],
      }),
    ).rejects.toMatchObject({
      name: 'MorselValidationError',
      code: 'EVALIDATE',
      issues: { port: 'must be between 1 and 65535' },
    });
  });
});
