import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  morselPlugin,
  setupTest,
  writeConfig,
} from '@oclio/morsel-test-helpers';

import { initConfig } from '@/index';

describe('init-config-idempotence — existing file handling', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('existing .json file → return path, no overwrite', async () => {
    const { projectDirectory } = await setupTest({
      projectConfig: {},
      projectFilename: '_setup-test.json',
    });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 9999,
      original: true,
    });

    const result = initConfig({
      name: 'myapp',
      cwd: projectDirectory,
      content: { port: 3000 },
    });

    expect(result).toBe(path.resolve(projectDirectory, 'myapp.config.json'));

    const content = JSON.parse(readFileSync(result, 'utf8')) as Record<
      string,
      unknown
    >;
    expect(content).toEqual({ port: 9999, original: true });
  });

  it('existing .morsel file → return path, no overwrite', async () => {
    const { projectDirectory } = await setupTest({
      projectConfig: {},
      projectFilename: '_setup-test.json',
    });

    const morselPath = path.resolve(projectDirectory, 'myapp.config.morsel');
    await writeFile(morselPath, 'port=3000', 'utf8');

    const result = initConfig({
      name: 'myapp',
      cwd: projectDirectory,
      content: { port: 9999 },
      formatPlugins: [morselPlugin],
    } as never);

    expect(result).toBe(morselPath);

    const content = readFileSync(morselPath, 'utf8');
    expect(content).toBe('port=3000');
  });

  it('existing file in .config/ directory → return path, no write', async () => {
    const { projectDirectory } = await setupTest({
      projectConfig: {},
      projectFilename: '_setup-test.json',
    });

    const configDirectory = path.resolve(projectDirectory, '.config');
    await mkdir(configDirectory, { recursive: true });
    const configPath = path.resolve(configDirectory, 'myapp.json');
    await writeConfig(configDirectory, 'myapp.json', {
      port: 9999,
      configDir: true,
    });

    const result = initConfig({
      name: 'myapp',
      cwd: projectDirectory,
      content: { port: 3000 },
    });

    expect(result).toBe(configPath);
    expect(
      existsSync(path.resolve(projectDirectory, 'myapp.config.json')),
    ).toBe(false);

    const content = JSON.parse(readFileSync(result, 'utf8')) as Record<
      string,
      unknown
    >;
    expect(content).toEqual({ port: 9999, configDir: true });
  });
});
