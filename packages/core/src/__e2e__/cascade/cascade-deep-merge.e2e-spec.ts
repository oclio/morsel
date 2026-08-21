import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('cascade-deep-merge — nested objects merged recursively', () => {
  clearWatcherRegistry();

  it('nested objects are merged, not replaced', async () => {
    const { directory } = await createTemporaryEnvironment();
    const globalDirectoryPath = `${directory}/global`;
    const projectDirectory = `${directory}/project`;

    await writeConfig(globalDirectoryPath, 'myapp.config.json', {
      server: { host: '0.0.0.0', port: 8080 },
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      server: { port: 3000, timeout: 5000 },
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectoryPath,
      defaults: { server: { host: 'localhost', retries: 3 } },
    });

    expect(config).toEqual({
      server: { host: '0.0.0.0', port: 3000, timeout: 5000, retries: 3 },
    });
  });
});
