import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { initConfig } from '@/index';

describe('init-config-existing-no-overwrite — existing file → return path, no write', () => {
  clearWatcherRegistry();

  it('returns existing path without overwriting content', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

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
});
