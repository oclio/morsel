import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('hooks-throw-boot — hook throw at boot throws MorselError EHOOK', () => {
  clearWatcherRegistry();

  it('hook throwing at boot produces MorselError with EHOOK code', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const hooks = [
      {
        name: 'boom',
        lifecycle: 'before:defaults' as const,
        load: () => {
          throw new Error('kaboom');
        },
      },
    ];

    await expect(
      loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: `${directory}/global`,
        hooks,
      }),
    ).rejects.toMatchObject({
      name: 'MorselError',
      code: 'EHOOK',
    });
  });
});
