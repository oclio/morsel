import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
} from '@oclio/morsel-e2e-helpers';

import { initConfig } from '@/index';

describe('init-config-fallback-content — no content, fallbackContent provided', () => {
  clearWatcherRegistry();

  it('writes fallbackContent when content is not provided', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    const result = initConfig({
      name: 'myapp',
      cwd: projectDirectory,
      fallbackContent: { port: 3000, host: 'localhost' },
    });

    expect(result).toBe(path.resolve(projectDirectory, 'myapp.config.json'));

    const written = JSON.parse(readFileSync(result, 'utf8')) as Record<
      string,
      unknown
    >;
    expect(written).toEqual({ port: 3000, host: 'localhost' });
  });
});
