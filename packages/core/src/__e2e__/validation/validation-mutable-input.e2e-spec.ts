import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('validation-mutable-input — first plugin receives mutable config', () => {
  clearWatcherRegistry();

  it('first plugin can mutate the config object', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    let wasMutable = false;

    const validate = (config: Record<string, unknown>) => {
      const result = { ...config, extra: true };
      if (!Object.isFrozen(config)) {
        wasMutable = true;
      }
      return result;
    };

    await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      validationPlugins: [{ name: 'check-mutable', validate }],
    });

    expect(wasMutable).toBe(true);
  });
});
