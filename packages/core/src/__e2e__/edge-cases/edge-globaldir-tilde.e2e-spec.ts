import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-test-helpers';

import { loadConfig } from '@/index';

describe('edge-globaldir-tilde — tilde expansion via homedir()', () => {
  clearWatcherRegistry();

  it('globalDir with ~ expands to homedir()', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await mkdir(projectDirectory, { recursive: true });
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const expectedGlobalDirectory = path.resolve(homedir(), '.morsel-test-e2e');
    await mkdir(expectedGlobalDirectory, { recursive: true });
    await writeConfig(expectedGlobalDirectory, 'myapp.config.json', {});

    const { config, layers } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: '~/.morsel-test-e2e',
    });

    expect(config).toEqual({ port: 3000 });

    const globalLayer = layers.find((layer) => layer.source === 'global');
    expect(globalLayer?.path).toBe(
      path.resolve(expectedGlobalDirectory, 'myapp.config.json'),
    );
  });
});
