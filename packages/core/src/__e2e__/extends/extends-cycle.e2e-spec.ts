import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('extends-cycle — A extends B extends A', () => {
  clearWatcherRegistry();

  it('throws MorselError(ECYCLE)', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'a.json', {
      extends: './b.json',
      port: 3000,
    });
    await writeConfig(projectDirectory, 'b.json', {
      extends: './a.json',
      port: 8080,
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './a.json',
    });

    await expect(
      loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: `${directory}/global`,
      }),
    ).rejects.toMatchObject({
      name: 'MorselError',
      code: 'ECYCLE',
    });
  });
});
