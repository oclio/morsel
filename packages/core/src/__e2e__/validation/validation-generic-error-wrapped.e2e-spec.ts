import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('validation-generic-error-wrapped — generic Error wrapped', () => {
  clearWatcherRegistry();

  it('plugin throws generic Error → wrapped with { [name]: message }', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', { port: -1 });

    const validate = () => {
      throw new Error('port must be positive');
    };

    await expect(
      loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: `${directory}/global`,
        validationPlugins: [{ name: 'positive', validate }],
      }),
    ).rejects.toMatchObject({
      name: 'ValidationError',
      code: 'EVALIDATE',
      issues: { positive: 'port must be positive' },
    });
  });
});
