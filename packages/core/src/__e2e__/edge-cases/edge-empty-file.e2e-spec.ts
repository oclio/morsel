import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('edge-empty-file — 0 bytes file throws EPARSE', () => {
  clearWatcherRegistry();

  it('empty 0-byte file → MorselError(EPARSE)', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await mkdir(projectDirectory, { recursive: true });
    const configPath = path.resolve(projectDirectory, 'myapp.config.json');
    await writeFile(configPath, '', 'utf8');

    await expect(
      loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: `${directory}/global`,
      }),
    ).rejects.toMatchObject({
      name: 'MorselError',
      code: 'EPARSE',
    });
  });
});
