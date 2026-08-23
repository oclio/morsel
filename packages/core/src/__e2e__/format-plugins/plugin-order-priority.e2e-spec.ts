import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('plugin-order-priority — first plugin in array wins for same extension', () => {
  clearWatcherRegistry();

  it('two plugins covering .json → first in array takes priority', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await mkdir(projectDirectory, { recursive: true });
    await writeFile(
      path.resolve(projectDirectory, 'myapp.config.json'),
      '{"port": 3000}',
      'utf8',
    );

    const pluginA = {
      name: 'plugin-a',
      extensions: ['.json'],
      parse: () => ({ source: 'A' }),
      serialize: () => '',
    };

    const pluginB = {
      name: 'plugin-b',
      extensions: ['.json'],
      parse: () => ({ source: 'B' }),
      serialize: () => '',
    };

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      formatPlugins: [pluginA, pluginB],
    });

    expect(config).toEqual({ source: 'A' });
  });
});
