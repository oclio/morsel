import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { defineConfig, loadConfig, mergeConfig } from '@/index';

describe('helper-merge-config-load — full pipeline with merged options', () => {
  clearWatcherRegistry();

  it('loadConfig(mergeConfig(base, prod)) → merged defaults applied', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await mkdir(projectDirectory, { recursive: true });
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });

    const base = defineConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      defaults: { port: 3000, host: 'localhost' },
    });

    const production = {
      defaults: { host: 'production.example.com' },
    };

    const merged = mergeConfig(base, production);

    const { config } = await loadConfig(merged);

    expect(config).toEqual({
      port: 8080,
      host: 'production.example.com',
    });
  });
});
