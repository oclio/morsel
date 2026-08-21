import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
} from '@oclio/morsel-e2e-helpers';

import { initConfig } from '@/index';

describe('init-config-create — no existing file → writes ./<name>.config.json', () => {
  clearWatcherRegistry();

  it('writes myapp.config.json and returns the path', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    const result = initConfig({
      name: 'myapp',
      cwd: projectDirectory,
      content: { port: 3000 },
    });

    expect(result).toBe(path.resolve(projectDirectory, 'myapp.config.json'));
    expect(existsSync(result)).toBe(true);

    const written = JSON.parse(readFileSync(result, 'utf8')) as Record<
      string,
      unknown
    >;
    expect(written).toEqual({ port: 3000 });
  });
});
