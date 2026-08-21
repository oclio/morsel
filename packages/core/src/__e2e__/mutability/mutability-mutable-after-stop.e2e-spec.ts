import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('mutability-mutable-after-stop — config stays mutable after stop', () => {
  clearWatcherRegistry();

  it('config is still mutable and readable after stop()', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;
    const globalDirectory = `${directory}/global`;

    await mkdir(projectDirectory, { recursive: true });
    await mkdir(globalDirectory, { recursive: true });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      host: 'localhost',
    });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      configMutability: 'mutable',
    });

    expect(store.config).toEqual({ port: 3000, host: 'localhost' });
    expect(Object.isFrozen(store.config)).toBe(false);

    await store.stop();

    expect(store.config).toEqual({ port: 3000, host: 'localhost' });
    expect(Object.isFrozen(store.config)).toBe(false);

    const mutated = store.config as Record<string, unknown>;
    mutated['port'] = 9999;
    expect(mutated['port']).toBe(9999);
  });
});
