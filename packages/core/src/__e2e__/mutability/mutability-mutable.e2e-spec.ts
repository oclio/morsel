import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('mutability-mutable — configMutability: mutable → plain object', () => {
  clearWatcherRegistry();

  it('config is not frozen and can be mutated freely', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      configMutability: 'mutable',
    });

    expect(Object.isFrozen(config)).toBe(false);

    const mutable = config as Record<string, unknown>;
    mutable['port'] = 8080;
    expect(mutable['port']).toBe(8080);
  });
});
