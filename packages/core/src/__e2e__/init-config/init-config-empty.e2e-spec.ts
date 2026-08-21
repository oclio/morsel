import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
} from '@oclio/morsel-e2e-helpers';

import { initConfig } from '@/index';

describe('init-config-empty — no content, no fallbackContent → writes {}', () => {
  clearWatcherRegistry();

  it('writes empty object when neither content nor fallbackContent provided', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    const result = initConfig({
      name: 'myapp',
      cwd: projectDirectory,
    });

    expect(result).toBe(path.resolve(projectDirectory, 'myapp.config.json'));

    const written = JSON.parse(readFileSync(result, 'utf8')) as Record<
      string,
      unknown
    >;
    expect(written).toEqual({});
  });
});
