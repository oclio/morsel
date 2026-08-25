import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig, MorselError, watchConfig } from '@/index';

describe('boot-errors — error cases at boot', () => {
  let directory: string;
  let projectDirectory: string;
  let globalDirectory: string;

  beforeEach(async () => {
    clearWatcherRegistry();
    const env = await createTemporaryEnvironment();
    directory = env.directory;
    projectDirectory = `${directory}/project`;
    globalDirectory = `${directory}/global`;
  });

  it('throws MorselError(EPARSE) on invalid JSON via loadConfig', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    const configPath = path.resolve(projectDirectory, 'myapp.config.json');
    await writeFile(configPath, '{ invalid json !!!', 'utf8');

    await expect(
      loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
      }),
    ).rejects.toMatchObject({
      name: 'MorselError',
      code: 'EPARSE',
      path: configPath,
    });
  });

  it('throws MorselError(EPARSE) on invalid JSON via watchConfig', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    const configPath = path.resolve(projectDirectory, 'myapp.config.json');
    await writeFile(configPath, '{ invalid json !!!', 'utf8');

    await expect(
      watchConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
      }),
    ).rejects.toMatchObject({ name: 'MorselError', code: 'EPARSE' });
  });

  it('throws MorselError(EPARSE) on empty 0-byte file', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    const configPath = path.resolve(projectDirectory, 'myapp.config.json');
    await writeFile(configPath, '', 'utf8');

    await expect(
      loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
      }),
    ).rejects.toMatchObject({ name: 'MorselError', code: 'EPARSE' });
  });

  it('MorselError has path, code, and cause', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    const configPath = path.resolve(projectDirectory, 'myapp.config.json');
    await writeFile(configPath, '{ invalid }', 'utf8');

    try {
      await loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
      });
      throw new TypeError('expected loadConfig to throw');
    } catch (error) {
      const morselError = error as MorselError;
      expect(morselError.name).toBe('MorselError');
      expect(morselError.code).toBe('EPARSE');
      expect(morselError.path).toBe(configPath);
      expect(morselError.cause).toBeDefined();
    }
  });
});
