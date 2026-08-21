import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
} from '@oclio/morsel-e2e-helpers';

import { initConfig } from '@/index';

describe('init-config-mkdir — cwd does not exist → mkdirSync creates parents', () => {
  clearWatcherRegistry();

  it('creates nested directory structure and writes config', async () => {
    const { directory } = await createTemporaryEnvironment();
    const nestedDirectory = `${directory}/project/nested/deep`;

    expect(existsSync(nestedDirectory)).toBe(false);

    const result = initConfig({
      name: 'myapp',
      cwd: nestedDirectory,
      content: { port: 3000 },
    });

    expect(result).toBe(path.resolve(nestedDirectory, 'myapp.config.json'));
    expect(existsSync(result)).toBe(true);

    const written = JSON.parse(readFileSync(result, 'utf8')) as Record<
      string,
      unknown
    >;
    expect(written).toEqual({ port: 3000 });
  });
});
