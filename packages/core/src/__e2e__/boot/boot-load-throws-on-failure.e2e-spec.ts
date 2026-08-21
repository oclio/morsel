import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('boot-load-throws-on-failure — corrupted project file', () => {
  clearWatcherRegistry();

  it('throws MorselError(EPARSE) on invalid JSON', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    // Corrupt the file with invalid JSON
    const configPath = path.resolve(projectDirectory, 'myapp.config.json');
    await writeFile(configPath, '{ invalid json !!!', 'utf8');

    await expect(
      loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: `${directory}/global`,
      }),
    ).rejects.toMatchObject({ name: 'MorselError', code: 'EPARSE' });
  });
});
