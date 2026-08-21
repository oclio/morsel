import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('hooks-with-extends — hooks and extends in same pipeline', () => {
  clearWatcherRegistry();

  it('hook layers and extends layers combined correctly', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'base.json', {
      port: 4000,
      base: true,
    });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './base.json',
      project: true,
    });

    const hooks = [
      {
        name: 'hook',
        lifecycle: 'after:project' as const,
        load: () => ({ hookKey: 'val' }),
      },
    ];

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      hooks,
    });

    expect(config).toEqual({
      port: 4000,
      base: true,
      project: true,
      hookKey: 'val',
    });
  });
});
