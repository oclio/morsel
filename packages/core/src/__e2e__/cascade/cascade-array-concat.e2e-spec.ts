import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('cascade-array-concat — arrayMerge concat concatenates arrays', () => {
  clearWatcherRegistry();

  it('arrays are concatenated with arrayMerge: concat', async () => {
    const { directory } = await createTemporaryEnvironment();
    const globalDirectoryPath = `${directory}/global`;
    const projectDirectory = `${directory}/project`;

    await writeConfig(globalDirectoryPath, 'myapp.config.json', {
      tags: ['a', 'b'],
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      tags: ['c', 'd'],
    });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectoryPath,
      defaults: { tags: ['default'] },
      overrides: { tags: ['override'] },
      arrayMerge: 'concat',
    });

    expect(config).toEqual({
      tags: ['default', 'a', 'b', 'c', 'd', 'override'],
    });
  });
});
