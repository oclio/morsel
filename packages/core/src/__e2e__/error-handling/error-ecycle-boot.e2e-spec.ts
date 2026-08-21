import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('error-ecycle-boot — circular extends at boot throws ECYCLE', () => {
  clearWatcherRegistry();

  it('A extends B extends A → MorselError(ECYCLE)', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await mkdir(projectDirectory, { recursive: true });
    await writeConfig(projectDirectory, 'a.config.json', {
      extends: './b.config.json',
    });
    await writeConfig(projectDirectory, 'b.config.json', {
      extends: './a.config.json',
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './a.config.json',
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
