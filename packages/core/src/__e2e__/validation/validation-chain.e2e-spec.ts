import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('validation-chain — 2 plugins in sequence', () => {
  clearWatcherRegistry();

  it('output of plugin 1 feeds into plugin 2', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: '3000',
    });

    const coerce = (config: Record<string, unknown>) => {
      const result = { ...config };
      if (typeof result['port'] === 'string') {
        result['port'] = Number(result['port']);
      }
      return result;
    };

    const addDefault = (config: Record<string, unknown>) => {
      return { host: 'localhost', ...config };
    };

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      validationPlugins: [
        { name: 'coerce', validate: coerce },
        { name: 'defaults', validate: addDefault },
      ],
    });

    expect(config).toEqual({ host: 'localhost', port: 3000 });
  });
});
