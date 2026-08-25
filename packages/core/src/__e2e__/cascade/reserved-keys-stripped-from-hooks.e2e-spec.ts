import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
} from '@oclio/morsel-e2e-helpers';

import type { Hook } from '@/index';
import { loadConfig, loadConfigSync } from '@/index';

describe('reserved-keys-stripped-from-hooks — extends and $env stripped from hook layers', () => {
  clearWatcherRegistry();

  it('strips extends and ignores $env when envName does not match (async)', async () => {
    const { directory } = await createTemporaryEnvironment();

    const hooks: readonly Hook[] = [
      {
        name: 'reserved-hook',
        lifecycle: 'before:defaults',
        load: () => ({
          app: 'myapp',
          extends: './should-be-stripped.json',
          $env: {
            production: { fromEnv: true },
          },
        }),
      },
    ];

    const { config, layers } = await loadConfig({
      name: 'myapp',
      cwd: `${directory}/project`,
      globalDir: `${directory}/global`,
      hooks,
      envName: 'development',
    });

    expect(config).not.toHaveProperty('extends');
    expect(config).not.toHaveProperty('$env');
    expect(config).not.toHaveProperty('fromEnv');
    expect(config['app']).toBe('myapp');

    const hookLayer = layers.find((layer) => layer.source === 'hook');
    expect(hookLayer).toBeDefined();
    expect(hookLayer!.config).not.toHaveProperty('extends');
    expect(hookLayer!.config).not.toHaveProperty('$env');
    expect(hookLayer!.config).not.toHaveProperty('fromEnv');
    expect(hookLayer!.config['app']).toBe('myapp');
  });

  it('strips extends and ignores $env when envName does not match (sync)', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'morsel-e2e-'));

    const hooks: readonly Hook[] = [
      {
        name: 'reserved-hook-sync',
        lifecycle: 'before:defaults',
        load: () => ({
          app: 'myapp-sync',
          extends: './should-be-stripped.json',
          $env: {
            production: { fromEnv: true },
          },
        }),
      },
    ];

    const { config, layers } = loadConfigSync({
      name: 'myapp',
      cwd: directory,
      hooks,
      envName: 'test',
    });

    expect(config).not.toHaveProperty('extends');
    expect(config).not.toHaveProperty('$env');
    expect(config).not.toHaveProperty('fromEnv');
    expect(config['app']).toBe('myapp-sync');

    const hookLayer = layers.find((layer) => layer.source === 'hook');
    expect(hookLayer).toBeDefined();
    expect(hookLayer!.config).not.toHaveProperty('extends');
    expect(hookLayer!.config).not.toHaveProperty('$env');
  });

  it('resolves $env from hook output when envName matches', async () => {
    clearWatcherRegistry();
    const { directory } = await createTemporaryEnvironment();

    const hooks: readonly Hook[] = [
      {
        name: 'env-hook',
        lifecycle: 'before:defaults',
        load: () => ({
          base: 'value',
          $env: {
            production: { overridden: true },
          },
        }),
      },
    ];

    const { config, layers } = await loadConfig({
      name: 'myapp',
      cwd: `${directory}/project`,
      globalDir: `${directory}/global`,
      hooks,
      envName: 'production',
    });

    expect(config).not.toHaveProperty('$env');
    expect(config).toEqual({ base: 'value', overridden: true });

    const hookLayer = layers.find((layer) => layer.source === 'hook');
    expect(hookLayer).toBeDefined();
    expect(hookLayer!.config).not.toHaveProperty('$env');
    expect(hookLayer!.config).toEqual({ base: 'value', overridden: true });
  });
});
