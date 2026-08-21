import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('reserved-keys-stripped — extends and $env absent from final config', () => {
  clearWatcherRegistry();

  it('extends and $env stripped from file layers, defaults, and overrides', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      $env: {
        ci: { port: 8080 },
      },
      extends: './base.json',
    });

    const previousNodeEnvironment = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'ci';

    try {
      const { config, layers } = await loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: `${directory}/global`,
        defaults: { port: 4000, extends: './defaults-base.json' },
        overrides: { debug: true, extends: './overrides-base.json' },
      });

      expect(config).not.toHaveProperty('$env');
      expect(config).not.toHaveProperty('extends');

      for (const layer of layers) {
        expect(layer.config).not.toHaveProperty('$env');
        expect(layer.config).not.toHaveProperty('extends');
      }
    } finally {
      if (previousNodeEnvironment === undefined) {
        delete process.env['NODE_ENV'];
      } else {
        process.env['NODE_ENV'] = previousNodeEnvironment;
      }
    }
  });
});
