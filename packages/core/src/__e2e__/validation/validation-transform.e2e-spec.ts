import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('validation-transform — plugin transforms config', () => {
  clearWatcherRegistry();

  it('plugin coercion reflected in final config', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: '3000',
      debug: 'true',
    });

    const validate = (config: Record<string, unknown>) => {
      const result = { ...config };
      if (typeof result['port'] === 'string') {
        result['port'] = Number(result['port']);
      }
      if (result['debug'] === 'true') {
        result['debug'] = true;
      }
      return result;
    };

    const { config } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      validationPlugins: [{ name: 'coerce', validate }],
    });

    expect(config).toEqual({ port: 3000, debug: true });
    expect(typeof config['port']).toBe('number');
    expect(typeof config['debug']).toBe('boolean');
  });
});
