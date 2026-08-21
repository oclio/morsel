import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('plugin-empty-array-throws — formatPlugins: [] throws TypeError', () => {
  clearWatcherRegistry();

  it('empty formatPlugins array throws TypeError', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    await expect(
      loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: `${directory}/global`,
        formatPlugins: [],
      }),
    ).rejects.toThrow(TypeError);
  });
});
