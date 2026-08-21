import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('edge-large-extends-chain — 9 extends succeeds, 10+ ECYCLE', () => {
  clearWatcherRegistry();

  it('9-level extends chain loads successfully', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await mkdir(projectDirectory, { recursive: true });

    for (let index = 9; index >= 1; index--) {
      const config: Record<string, unknown> = { level: index };
      if (index < 9) {
        config['extends'] = `./level-${index + 1}.config.json`;
      }
      await writeConfig(projectDirectory, `level-${index}.config.json`, config);
    }

    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './level-1.config.json',
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
    });

    expect(config).toEqual({ level: 1 });
  });

  it('11-level extends chain throws MorselError(ECYCLE)', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await mkdir(projectDirectory, { recursive: true });

    for (let index = 11; index >= 1; index--) {
      const config: Record<string, unknown> = { level: index };
      if (index < 11) {
        config['extends'] = `./level-${index + 1}.config.json`;
      }
      await writeConfig(projectDirectory, `level-${index}.config.json`, config);
    }

    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './level-1.config.json',
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
