import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('cascade-undefined-ignored — undefined does not override', () => {
  clearWatcherRegistry();

  it('undefined in overrides does not overwrite, but other override keys do', async () => {
    const { directory } = await createTemporaryEnvironment();
    const globalDirectoryPath = `${directory}/global`;
    const projectDirectory = `${directory}/project`;

    await writeConfig(globalDirectoryPath, 'myapp.config.json', {
      host: 'global.example.com',
      port: 8080,
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectoryPath,
      defaults: { port: 4000, host: 'localhost', retries: 3 },
      overrides: { port: 9000, host: undefined, debug: true },
    });

    expect(config).toEqual({
      port: 9000,
      host: 'global.example.com',
      retries: 3,
      debug: true,
    });
  });
});
