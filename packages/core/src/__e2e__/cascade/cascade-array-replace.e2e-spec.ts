import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('cascade-array-replace — default arrayMerge replaces', () => {
  clearWatcherRegistry();

  it('arrays are replaced, not concatenated', async () => {
    const { directory } = await createTemporaryEnvironment();
    const globalDirectoryPath = `${directory}/global`;
    const projectDirectory = `${directory}/project`;

    await writeConfig(globalDirectoryPath, 'myapp.config.json', {
      tags: ['a', 'b', 'c'],
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      tags: ['x', 'y'],
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectoryPath,
      defaults: { tags: ['default'] },
    });

    expect(config).toEqual({ tags: ['x', 'y'] });
  });
});
