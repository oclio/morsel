import {
  assertRemerge,
  clearWatcherRegistry,
  setupTest,
  withEnvironmentVariable,
  writeConfig,
} from '@oclio/test-helpers';

import { interpolate } from '@/index';

describe('interpolation-pipeline — integration with pipeline', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('interpolation runs after merge, before validation', async () => {
    await withEnvironmentVariable('MORSEL_PORT', '8080', async () => {
      const validationPlugin = {
        name: 'port-validator',
        validate: (config: Record<string, unknown>) => {
          if (config['port'] !== '8080') {
            throw new Error('interpolation did not run before validation');
          }
          return { ...config, validated: true };
        },
      };

      const { result } = await setupTest({
        reactive: false,
        projectConfig: { port: '${MORSEL_PORT}' },
        createGlobalDir: true,
        validationPlugins: [validationPlugin],
      } as never);

      expect(result!.config).toEqual({ port: '8080', validated: true });
    });
  });

  it('interpolation in createReactiveStore boot', async () => {
    await withEnvironmentVariable('MORSEL_HOST', 'localhost', async () => {
      const { store } = await setupTest({
        projectConfig: { host: '${MORSEL_HOST}' },
        createGlobalDir: true,
      });

      expect(store!.config).toEqual({ host: 'localhost' });

      await store!.stop();
    });
  });

  it('interpolation in re-merge', async () => {
    await withEnvironmentVariable('MORSEL_HOST', 'localhost', async () => {
      const { store, projectDirectory } = await setupTest({
        projectConfig: { host: '${MORSEL_HOST}' },
        createGlobalDir: true,
      });

      expect(store!.config).toEqual({ host: 'localhost' });

      await withEnvironmentVariable('MORSEL_HOST', 'example.com', async () => {
        await writeConfig(projectDirectory, 'myapp.config.json', {
          host: '${MORSEL_HOST}',
        });

        await assertRemerge(store!, { host: 'example.com' });
      });

      await store!.stop();
    });
  });

  it('interpolation produces new config (deep clone before resolving)', () => {
    const input = { port: 3000, copy: '{{port}}' };
    const result = interpolate(input);

    expect(result).toEqual({ port: 3000, copy: 3000 });
    expect(result).not.toBe(input);
    expect(input['copy']).toBe('{{port}}');
  });
});
