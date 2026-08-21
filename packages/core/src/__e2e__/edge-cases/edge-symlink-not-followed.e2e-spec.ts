import { mkdir, symlink } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('edge-symlink-not-followed — config via symlink', () => {
  clearWatcherRegistry();

  it('symlinked config file is resolved via path.resolve, not realpath', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;
    const targetDirectory = `${directory}/target`;

    await mkdir(projectDirectory, { recursive: true });
    await mkdir(targetDirectory, { recursive: true });
    await writeConfig(targetDirectory, 'myapp.config.json', { port: 3000 });

    const symlinkPath = path.resolve(projectDirectory, 'myapp.config.json');
    const targetPath = path.resolve(targetDirectory, 'myapp.config.json');
    await symlink(targetPath, symlinkPath);

    const { config, layers } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
    });

    expect(config).toEqual({ port: 3000 });

    const projectLayer = layers.find((layer) => layer.source === 'project');
    expect(projectLayer?.exists).toBe(true);
    expect(projectLayer?.path).toBe(symlinkPath);
    expect(projectLayer?.path).not.toBe(targetPath);
  });
});
