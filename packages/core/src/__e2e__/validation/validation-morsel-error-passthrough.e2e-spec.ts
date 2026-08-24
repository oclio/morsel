import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig, ValidationError } from '@/index';

describe('validation-morsel-error-passthrough — ValidationError rethrown as-is', () => {
  clearWatcherRegistry();

  it('plugin throws ValidationError → rethrown with issues preserved', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const validate = () => {
      throw new ValidationError({ port: 'must be between 1 and 65535' });
    };

    await expect(
      loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: `${directory}/global`,
        validationPlugins: [{ name: 'range', validate }],
      }),
    ).rejects.toMatchObject({
      name: 'ValidationError',
      code: 'EVALIDATE',
      issues: { port: 'must be between 1 and 65535' },
    });
  });
});
