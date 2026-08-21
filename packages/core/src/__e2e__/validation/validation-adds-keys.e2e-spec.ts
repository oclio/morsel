import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('validation-adds-keys — plugin adds new keys to config', () => {
  clearWatcherRegistry();

  it('plugin adds extra keys that appear in final config', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await mkdir(projectDirectory, { recursive: true });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
    });

    const validationPlugin = {
      name: 'enricher',
      validate: (config: Record<string, unknown>) => ({
        ...config,
        extra: true,
        nested: { added: 'by-plugin' },
      }),
    };

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      validationPlugins: [validationPlugin],
    } as never);

    expect(config).toEqual({
      port: 3000,
      extra: true,
      nested: { added: 'by-plugin' },
    });
  });
});
