import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('hooks-lifecycle-order — 8 hooks, one per lifecycle point', () => {
  clearWatcherRegistry();

  it('layers inserted in correct pipeline order', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const hooks = [
      {
        name: 'h1',
        lifecycle: 'before:defaults' as const,
        load: () => ({ h1: true }),
      },
      {
        name: 'h2',
        lifecycle: 'after:defaults' as const,
        load: () => ({ h2: true }),
      },
      {
        name: 'h3',
        lifecycle: 'before:global' as const,
        load: () => ({ h3: true }),
      },
      {
        name: 'h4',
        lifecycle: 'after:global' as const,
        load: () => ({ h4: true }),
      },
      {
        name: 'h5',
        lifecycle: 'before:project' as const,
        load: () => ({ h5: true }),
      },
      {
        name: 'h6',
        lifecycle: 'after:project' as const,
        load: () => ({ h6: true }),
      },
      {
        name: 'h7',
        lifecycle: 'before:overrides' as const,
        load: () => ({ h7: true }),
      },
      {
        name: 'h8',
        lifecycle: 'after:overrides' as const,
        load: () => ({ h8: true }),
      },
    ];

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      defaults: { port: 3000 },
      overrides: { port: 4000 },
      hooks,
    });

    expect(config).toEqual({
      h1: true,
      h2: true,
      h3: true,
      h4: true,
      h5: true,
      h6: true,
      h7: true,
      h8: true,
      port: 4000,
    });
  });
});
