import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
} from '@oclio/morsel-e2e-helpers';

import { initConfig } from '@/index';

describe('init-config-custom-extension — initConfig with custom format plugin', () => {
  clearWatcherRegistry();

  it('creates file with custom extension from first format plugin', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await mkdir(projectDirectory, { recursive: true });

    const morselPlugin = {
      name: 'morsel',
      extensions: ['.morsel'],
      parse: (content: string) =>
        JSON.parse(content) as Record<string, unknown>,
    };

    const returnedPath = initConfig({
      name: 'myapp',
      cwd: projectDirectory,
      content: { port: 3000 },
      formatPlugins: [morselPlugin],
    } as never);

    expect(returnedPath).toBe(
      path.resolve(projectDirectory, 'myapp.config.morsel'),
    );

    const { readFile } = await import('node:fs/promises');
    const content = await readFile(returnedPath, 'utf8');
    expect(JSON.parse(content)).toEqual({ port: 3000 });
  });
});
