import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('hooks-multiple-same-lifecycle — 2 hooks on same lifecycle point', () => {
  clearWatcherRegistry();

  it('hooks executed in array order', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const hooks = [
      {
        name: 'first',
        lifecycle: 'before:defaults' as const,
        load: () => ({ a: 1 }),
      },
      {
        name: 'second',
        lifecycle: 'before:defaults' as const,
        load: () => ({ b: 2 }),
      },
    ];

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      hooks,
    });

    expect(config).toEqual({ a: 1, b: 2, port: 3000 });
  });
});
