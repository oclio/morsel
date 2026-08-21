import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('extends-relative-paths — resolved from declaring file dir', () => {
  clearWatcherRegistry();

  it('extends: "../shared/base.json" resolved from file dir, not cwd', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;
    const sharedDirectory = `${directory}/shared`;

    await writeConfig(sharedDirectory, 'base.json', {
      port: 8080,
      host: '0.0.0.0',
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: '../shared/base.json',
      port: 3000,
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
    });

    expect(config).toEqual({ port: 3000, host: '0.0.0.0' });
  });
});
