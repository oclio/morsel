import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  morselPlugin,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { jsonPlugin, loadConfig } from '@/index';

describe('plugin-multi-extension-discovery — 2 plugins, extension-based discovery', () => {
  clearWatcherRegistry();

  it('first plugin in array wins for discovery; morsel file used when json does not exist', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await mkdir(projectDirectory, { recursive: true });
    await writeFile(
      path.resolve(projectDirectory, 'myapp.config.morsel'),
      'port=3000',
      'utf8',
    );

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      formatPlugins: [morselPlugin, jsonPlugin],
    });

    expect(config).toEqual({ port: 3000 });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });

    const { config: config2 } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      formatPlugins: [morselPlugin, jsonPlugin],
    });

    expect(config2).toEqual({ port: 3000 });
  });
});
