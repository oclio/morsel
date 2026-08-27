import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { clearWatcherRegistry, setupTest } from '@oclio/morsel-e2e-helpers';

import { loadConfig, MorselError, watchConfig } from '@/index';

describe('boot-errors — error cases at boot', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('throws MorselError(EPARSE) on invalid JSON via loadConfig', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
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
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
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
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
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
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
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
