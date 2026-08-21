import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('error-ehook-boot — hook throw at boot throws EHOOK', () => {
  clearWatcherRegistry();

  it('hook.load throws → MorselError(EHOOK)', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await mkdir(projectDirectory, { recursive: true });
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const hooks = [
      {
        name: 'boom',
        lifecycle: 'before:defaults' as const,
        load: () => {
          throw new TypeError('kaboom');
        },
      },
    ];

    await expect(
      loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: `${directory}/global`,
        hooks,
      } as never),
    ).rejects.toMatchObject({
      name: 'MorselError',
      code: 'EHOOK',
    });
  });
});
