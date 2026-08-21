import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('extends-array — extends: [B, C]', () => {
  clearWatcherRegistry();

  it('merge in array order', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'b.json', {
      port: 8080,
      host: '0.0.0.0',
    });
    await writeConfig(projectDirectory, 'c.json', {
      port: 9000,
      timeout: 5000,
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: ['./b.json', './c.json'],
      port: 3000,
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
    });

    expect(config).toEqual({ port: 3000, host: '0.0.0.0', timeout: 5000 });
  });
});
