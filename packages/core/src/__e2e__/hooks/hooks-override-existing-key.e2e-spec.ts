import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('hooks-override-existing-key — before:defaults has lower priority', () => {
  clearWatcherRegistry();

  it('hook before:defaults returns same key as defaults → defaults wins', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await mkdir(projectDirectory, { recursive: true });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      host: 'localhost',
    });

    const hooks = [
      {
        name: 'override-attempt',
        lifecycle: 'before:defaults' as const,
        load: () => ({ port: 9999 }),
      },
    ];

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      defaults: { port: 3000 },
      hooks,
    } as never);

    expect(config).toEqual({ port: 3000, host: 'localhost' });
  });
});
