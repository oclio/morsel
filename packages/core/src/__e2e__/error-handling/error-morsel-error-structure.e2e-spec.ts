import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig, MorselError } from '@/index';

describe('error-morsel-error-structure — path, code, cause present', () => {
  clearWatcherRegistry();

  it('MorselError has path, code, and cause', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await mkdir(projectDirectory, { recursive: true });
    const configPath = path.resolve(projectDirectory, 'myapp.config.json');
    await writeFile(configPath, '{ invalid }', 'utf8');

    try {
      await loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: `${directory}/global`,
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
