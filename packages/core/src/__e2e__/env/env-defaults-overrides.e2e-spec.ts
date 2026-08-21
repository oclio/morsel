import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('env-defaults-overrides — defaults and overrides resolve $env', () => {
  clearWatcherRegistry();

  it('defaults and overrides apply $env but do not follow extends', async () => {
    const { directory } = await createTemporaryEnvironment();

    const { config, layers } = await loadConfig({
      name: 'myapp',
      cwd: directory,
      globalDir: `${directory}/global`,
      envName: 'ci',
      defaults: {
        port: 4000,
        $env: { ci: { port: 8080 } },
        extends: './defaults-base.json',
      },
      overrides: {
        host: 'localhost',
        $env: { ci: { host: '0.0.0.0' } },
        extends: './overrides-base.json',
      },
    });

    expect(config).toEqual({ port: 8080, host: '0.0.0.0' });

    const defaultsLayer = layers.find((layer) => layer.source === 'defaults');
    const overridesLayer = layers.find((layer) => layer.source === 'overrides');

    expect(defaultsLayer!.config).not.toHaveProperty('$env');
    expect(defaultsLayer!.config).not.toHaveProperty('extends');

    expect(overridesLayer!.config).not.toHaveProperty('$env');
    expect(overridesLayer!.config).not.toHaveProperty('extends');
  });
});
