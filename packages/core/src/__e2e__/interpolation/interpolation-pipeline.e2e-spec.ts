import {
  assertRemerge,
  clearWatcherRegistry,
  setupTest,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { interpolate } from '@/index';

describe('interpolation-pipeline — integration with pipeline', () => {
  const savedVariables = new Map<string, string | undefined>();

  beforeEach(() => {
    clearWatcherRegistry();
  });

  afterEach(() => {
    for (const [name, originalValue] of savedVariables) {
      if (originalValue === undefined) {
        Reflect.deleteProperty(process.env, name);
      } else {
        process.env[name] = originalValue;
      }
    }
    savedVariables.clear();
  });

  const setEnvironment = (name: string, value: string) => {
    if (!savedVariables.has(name)) {
      savedVariables.set(name, process.env[name]);
    }
    process.env[name] = value;
  };

  it('interpolation runs after merge, before validation', async () => {
    setEnvironment('MORSEL_PORT', '8080');

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
      projectConfig: { port: '${MORSEL_PORT}' },
      createGlobalDir: true,
      validationPlugins: [validationPlugin],
    } as never);

    expect(result!.config).toEqual({ port: '8080', validated: true });
  });

  it('interpolation in watchConfig boot', async () => {
    setEnvironment('MORSEL_HOST', 'localhost');

    const { store } = await setupTest({
      projectConfig: { host: '${MORSEL_HOST}' },
      watch: true,
      createGlobalDir: true,
    });

    expect(store!.config).toEqual({ host: 'localhost' });

    await store!.stop();
  });

  it('interpolation in re-merge', async () => {
    setEnvironment('MORSEL_HOST', 'localhost');

    const { store, projectDirectory } = await setupTest({
      projectConfig: { host: '${MORSEL_HOST}' },
      watch: true,
      createGlobalDir: true,
    });

    expect(store!.config).toEqual({ host: 'localhost' });

    setEnvironment('MORSEL_HOST', 'example.com');
    await writeConfig(projectDirectory, 'myapp.config.json', {
      host: '${MORSEL_HOST}',
    });

    await assertRemerge(store!, { host: 'example.com' });

    await store!.stop();
  });

  it('interpolation in mutateKey (after optimistic update)', async () => {
    setEnvironment('MORSEL_PORT', '8080');

    const { store } = await setupTest({
      projectConfig: { port: 3000, url: 'localhost' },
      watch: true,
      createGlobalDir: true,
      configMutability: 'mutable',
    });

    await store!.set('port', '${MORSEL_PORT}');

    expect(store!.config).toEqual({ port: '8080', url: 'localhost' });

    await store!.stop();
  });

  it('interpolation produces new config (deep clone before resolving)', () => {
    const input = { port: 3000, copy: '{{port}}' };
    const result = interpolate(input);

    expect(result).toEqual({ port: 3000, copy: 3000 });
    expect(result).not.toBe(input);
    expect(input['copy']).toBe('{{port}}');
  });
});
