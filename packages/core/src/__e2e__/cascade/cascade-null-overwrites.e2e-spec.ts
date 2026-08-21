import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('cascade-null-overwrites — null overwrites previous value', () => {
  clearWatcherRegistry();

  it('null in a higher layer resets the key from lower layers', async () => {
    const { directory } = await createTemporaryEnvironment();
    const globalDirectoryPath = `${directory}/global`;
    const projectDirectory = `${directory}/project`;

    await writeConfig(globalDirectoryPath, 'myapp.config.json', {
      host: 'global.example.com',
      port: 8080,
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      host: null,
      port: 3000,
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectoryPath,
      defaults: { host: 'localhost', port: 4000, debug: true },
      overrides: { port: null },
    });

    expect(config).toEqual({ host: null, port: null, debug: true });
  });
});
