import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('plugin-no-json-in-core — no JSON.parse outside jsonPlugin', () => {
  clearWatcherRegistry();

  it('custom plugin replacing json works without core calling JSON.parse', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await mkdir(projectDirectory, { recursive: true });
    await writeFile(
      path.resolve(projectDirectory, 'myapp.config.json'),
      '{"port": 3000}',
      'utf8',
    );

    let wasParseCalled = false;
    const customJsonPlugin = {
      name: 'custom-json',
      extensions: ['.json'],
      parse: (content: string) => {
        wasParseCalled = true;
        return JSON.parse(content) as Record<string, unknown>;
      },
      serialize: () => '',
    };

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      formatPlugins: [customJsonPlugin],
    });

    expect(wasParseCalled).toBe(true);
    expect(config).toEqual({ port: 3000 });
  });
});
