import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('boot-watch-throws-on-failure — corrupted project file at boot', () => {
  clearWatcherRegistry();

  it('throws MorselError(EPARSE), no store returned', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    // Corrupt the file with invalid JSON
    const configPath = path.resolve(projectDirectory, 'myapp.config.json');
    await writeFile(configPath, '{ invalid json !!!', 'utf8');

    await expect(
      watchConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: `${directory}/global`,
      }),
    ).rejects.toMatchObject({ name: 'MorselError', code: 'EPARSE' });
  });
});
