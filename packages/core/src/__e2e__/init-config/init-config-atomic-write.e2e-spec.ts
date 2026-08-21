import { existsSync, readdirSync, readFileSync } from 'node:fs';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
} from '@oclio/morsel-e2e-helpers';

import { initConfig } from '@/index';

describe('init-config-atomic-write — no residual .tmp file', () => {
  clearWatcherRegistry();

  it('writes atomically without leaving .tmp file behind', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    const result = initConfig({
      name: 'myapp',
      cwd: projectDirectory,
      content: { port: 3000 },
    });

    expect(existsSync(result)).toBe(true);
    expect(existsSync(`${result}.tmp`)).toBe(false);

    const files = readdirSync(projectDirectory);
    expect(files).not.toContain('myapp.config.json.tmp');

    const written = JSON.parse(readFileSync(result, 'utf8')) as Record<
      string,
      unknown
    >;
    expect(written).toEqual({ port: 3000 });
  });
});
