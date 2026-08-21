import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('hooks-async — async hook in loadConfig', () => {
  clearWatcherRegistry();

  it('async hook awaited and layer produced', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const hooks = [
      {
        name: 'async-hook',
        lifecycle: 'before:defaults' as const,
        load: () => Promise.resolve({ asyncKey: 'async-value' }),
      },
    ];

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      hooks,
    });

    expect(config).toEqual({ asyncKey: 'async-value', port: 3000 });
  });
});
