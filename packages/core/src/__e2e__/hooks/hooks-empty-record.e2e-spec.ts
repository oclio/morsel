import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('hooks-empty-record — hook returns empty object', () => {
  clearWatcherRegistry();

  it('hook returning {} produces empty layer, no effect on config', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const hooks = [
      {
        name: 'empty',
        lifecycle: 'before:defaults' as const,
        load: () => ({}),
      },
    ];

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      defaults: { port: 3000 },
      hooks,
    });

    expect(config).toEqual({ port: 3000 });
  });
});
