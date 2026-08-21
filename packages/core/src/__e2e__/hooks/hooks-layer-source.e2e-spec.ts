import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('hooks-layer-source — hook layer has source: hook, hookName set', () => {
  clearWatcherRegistry();

  it('layer produced by hook has source=hook and hookName', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const hooks = [
      {
        name: 'my-hook',
        lifecycle: 'before:defaults' as const,
        load: () => ({ hookKey: 'val' }),
      },
    ];

    const { layers } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      hooks,
    });

    const hookLayer = layers.find((l) => l.source === 'hook');
    expect(hookLayer).toBeDefined();
    expect(hookLayer?.hookName).toBe('my-hook');
    expect(hookLayer?.config).toEqual({ hookKey: 'val' });
  });
});
