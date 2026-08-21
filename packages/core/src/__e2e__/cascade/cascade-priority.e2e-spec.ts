import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('cascade-priority — defaults < global < project < overrides', () => {
  clearWatcherRegistry();

  it('highest priority wins for shared key', async () => {
    const { directory } = await createTemporaryEnvironment();
    const globalDirectoryPath = `${directory}/global`;
    const projectDirectory = `${directory}/project`;

    await writeConfig(globalDirectoryPath, 'myapp.config.json', {
      port: 8080,
      host: 'global.example.com',
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      timeout: 5000,
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectoryPath,
      defaults: { port: 4000, retries: 3 },
      overrides: { port: 9000, debug: true },
    });

    expect(config).toEqual({
      port: 9000,
      host: 'global.example.com',
      timeout: 5000,
      retries: 3,
      debug: true,
    });
  });
});
