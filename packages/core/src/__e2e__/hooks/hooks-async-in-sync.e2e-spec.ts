import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfigSync } from '@/index';

describe('hooks-async-in-sync — async hook in loadConfigSync throws TypeError', () => {
  clearWatcherRegistry();

  it('async hook throws TypeError in loadConfigSync', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const hooks = [
      {
        name: 'async-hook',
        lifecycle: 'before:defaults' as const,
        load: () => Promise.resolve({ key: 'value' }),
      },
    ];

    expect(() =>
      loadConfigSync({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: `${directory}/global`,
        hooks,
      }),
    ).toThrow(TypeError);
  });
});
