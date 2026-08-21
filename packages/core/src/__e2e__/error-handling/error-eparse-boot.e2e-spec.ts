import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('error-eparse-boot — invalid JSON at boot throws EPARSE', () => {
  clearWatcherRegistry();

  it('MorselError(EPARSE) thrown with file path', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await mkdir(projectDirectory, { recursive: true });
    const configPath = path.resolve(projectDirectory, 'myapp.config.json');
    await writeFile(configPath, '{ invalid json }', 'utf8');

    await expect(
      loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: `${directory}/global`,
      }),
    ).rejects.toMatchObject({
      name: 'MorselError',
      code: 'EPARSE',
      path: configPath,
    });
  });
});
