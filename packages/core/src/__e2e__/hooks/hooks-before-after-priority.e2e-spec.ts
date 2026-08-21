import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('hooks-before-after-priority — before:project lower, after:project higher', () => {
  clearWatcherRegistry();

  it('before:project layer has lower priority than project, after:project higher', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const hooks = [
      {
        name: 'before-project',
        lifecycle: 'before:project' as const,
        load: () => ({ port: 1000 }),
      },
      {
        name: 'after-project',
        lifecycle: 'after:project' as const,
        load: () => ({ port: 5000 }),
      },
    ];

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      hooks,
    });

    expect(config).toEqual({ port: 5000 });
  });
});
