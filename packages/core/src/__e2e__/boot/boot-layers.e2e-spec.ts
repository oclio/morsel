import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { clearWatcherRegistry, setupTest } from '@oclio/morsel-e2e-helpers';

import { loadConfigSync } from '@/index';

describe('boot-layers — layer resolution + $env + hooks', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('defaults and overrides deep-merge when no globalDir and no files on disk', async () => {
    const { result } = await setupTest({
      rootAsCwd: true,
      skipGlobalDirectory: true,
      defaults: { port: 3000, host: 'localhost' },
      overrides: { host: '0.0.0.0', debug: true },
    });

    const { config, layers } = result!;

    expect(config).toEqual({ port: 3000, host: '0.0.0.0', debug: true });
    expect(layers).toHaveLength(4);

    const [defaultsLayer, globalLayer, projectLayer, overridesLayer] = layers;

    expect(defaultsLayer!.source).toBe('defaults');
    expect(defaultsLayer!.exists).toBe(true);
    expect(defaultsLayer!.config).toEqual({ port: 3000, host: 'localhost' });
    expect(defaultsLayer!.path).toBeUndefined();

    expect(globalLayer!.source).toBe('global');
    expect(globalLayer!.exists).toBe(false);
    expect(globalLayer!.config).toEqual({});
    expect(globalLayer!.path).toBeUndefined();

    expect(projectLayer!.source).toBe('project');
    expect(projectLayer!.exists).toBe(false);
    expect(projectLayer!.config).toEqual({});
    expect(projectLayer!.path).toBeUndefined();

    expect(overridesLayer!.source).toBe('overrides');
    expect(overridesLayer!.exists).toBe(true);
    expect(overridesLayer!.config).toEqual({ host: '0.0.0.0', debug: true });
    expect(overridesLayer!.path).toBeUndefined();
  });

  it('defaults: $env resolved per envName, extends stripped, via sync API', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'morsel-e2e-'));

    const { config, layers } = loadConfigSync({
      name: 'myapp',
      cwd: directory,
      envName: 'production',
      defaults: {
        port: 3000,
        nested: { a: 1, b: 2 },
        $env: {
          production: { port: 9000, nested: { b: 20 } },
          development: { port: 4000 },
        },
        extends: './should-be-stripped.json',
      },
    });

    expect(config).toEqual({ port: 9000, nested: { a: 1, b: 20 } });

    const [defaultsLayer] = layers;

    expect(defaultsLayer!.source).toBe('defaults');
    expect(defaultsLayer!.exists).toBe(true);
    expect(defaultsLayer!.config).toEqual({
      port: 9000,
      nested: { a: 1, b: 20 },
    });
    expect(defaultsLayer!.config).not.toHaveProperty('$env');
    expect(defaultsLayer!.config).not.toHaveProperty('extends');
  });

  it('deep-merges all layers by increasing priority', async () => {
    const { result } = await setupTest({
      globalConfig: {
        port: 8080,
        host: '0.0.0.0',
        features: { auth: false, cache: true },
      },
      projectConfig: {
        port: 3000,
        features: { auth: true, logging: true },
      },
      defaults: { port: 4000, host: 'localhost', features: { cache: false } },
      overrides: { host: '127.0.0.1' },
    });

    const { config, layers } = result!;

    expect(config).toEqual({
      port: 3000,
      host: '127.0.0.1',
      features: { auth: true, cache: true, logging: true },
    });

    expect(layers).toHaveLength(4);
    const [defaultsLayer, globalLayer, projectLayer, overridesLayer] = layers;

    expect(defaultsLayer!.source).toBe('defaults');
    expect(defaultsLayer!.exists).toBe(true);

    expect(globalLayer!.source).toBe('global');
    expect(globalLayer!.exists).toBe(true);

    expect(projectLayer!.source).toBe('project');
    expect(projectLayer!.exists).toBe(true);

    expect(overridesLayer!.source).toBe('overrides');
    expect(overridesLayer!.exists).toBe(true);
  });

  it('defaults: $env resolved per envName, extends stripped, no file on disk', async () => {
    const { result } = await setupTest({
      rootAsCwd: true,
      envName: 'production',
      defaults: {
        port: 3000,
        host: 'localhost',
        $env: {
          production: { port: 9000, debug: false },
          development: { port: 4000, debug: true },
        },
        extends: './should-be-stripped.json',
      },
    });

    const { config, layers } = result!;

    expect(config).toEqual({ port: 9000, host: 'localhost', debug: false });

    const [defaultsLayer, globalLayer, projectLayer, overridesLayer] = layers;

    expect(defaultsLayer!.source).toBe('defaults');
    expect(defaultsLayer!.exists).toBe(true);
    expect(defaultsLayer!.config).toEqual({
      port: 9000,
      host: 'localhost',
      debug: false,
    });
    expect(defaultsLayer!.config).not.toHaveProperty('$env');
    expect(defaultsLayer!.config).not.toHaveProperty('extends');

    expect(globalLayer!.source).toBe('global');
    expect(globalLayer!.exists).toBe(false);

    expect(projectLayer!.source).toBe('project');
    expect(projectLayer!.exists).toBe(false);

    expect(overridesLayer!.source).toBe('overrides');
    expect(overridesLayer!.exists).toBe(true);
    expect(overridesLayer!.config).toEqual({});
  });

  it('overrides: $env resolved per envName, extends stripped, deep-merged over defaults', async () => {
    const { result } = await setupTest({
      rootAsCwd: true,
      envName: 'production',
      defaults: { port: 3000, host: 'localhost', features: { cache: true } },
      overrides: {
        host: '0.0.0.0',
        features: { auth: true },
        $env: {
          production: { port: 9000, features: { cache: false } },
          development: { port: 4000 },
        },
        extends: './should-be-stripped.json',
      },
    });

    const { config, layers } = result!;

    expect(config).toEqual({
      port: 9000,
      host: '0.0.0.0',
      features: { cache: false, auth: true },
    });

    const [defaultsLayer, globalLayer, projectLayer, overridesLayer] = layers;

    expect(defaultsLayer!.source).toBe('defaults');
    expect(defaultsLayer!.exists).toBe(true);

    expect(globalLayer!.source).toBe('global');
    expect(globalLayer!.exists).toBe(false);

    expect(projectLayer!.source).toBe('project');
    expect(projectLayer!.exists).toBe(false);

    expect(overridesLayer!.source).toBe('overrides');
    expect(overridesLayer!.exists).toBe(true);
    expect(overridesLayer!.config).toEqual({
      port: 9000,
      host: '0.0.0.0',
      features: { cache: false, auth: true },
    });
    expect(overridesLayer!.config).not.toHaveProperty('$env');
    expect(overridesLayer!.config).not.toHaveProperty('extends');
  });

  it('defaults + overrides both with $env resolved independently per layer', async () => {
    const { result } = await setupTest({
      rootAsCwd: true,
      envName: 'production',
      defaults: {
        port: 3000,
        $env: {
          production: { port: 9000 },
        },
      },
      overrides: {
        host: 'localhost',
        $env: {
          production: { host: '0.0.0.0' },
        },
      },
    });

    const { config, layers } = result!;

    expect(config).toEqual({ port: 9000, host: '0.0.0.0' });

    const defaultsLayer = layers.find((l) => l.source === 'defaults');
    const overridesLayer = layers.find((l) => l.source === 'overrides');

    expect(defaultsLayer!.config).toEqual({ port: 9000 });
    expect(defaultsLayer!.config).not.toHaveProperty('$env');

    expect(overridesLayer!.config).toEqual({ host: '0.0.0.0' });
    expect(overridesLayer!.config).not.toHaveProperty('$env');
  });

  it('$env block not a plain object → debug warning, $env ignored', async () => {
    const debugMessages: string[] = [];

    const { result } = await setupTest({
      rootAsCwd: true,
      envName: 'production',
      defaults: {
        port: 3000,
        $env: 'not-an-object',
      },
      onDebug: (message: string) => {
        debugMessages.push(message);
      },
    } as never);

    expect(result!.config).toEqual({ port: 3000 });
    expect(debugMessages.some((m) => m.includes('$env'))).toBe(true);
  });

  it('envName matches but $env[envName] not a plain object → $env silently ignored, no warning', async () => {
    const debugMessages: string[] = [];

    const { result } = await setupTest({
      rootAsCwd: true,
      envName: 'production',
      defaults: {
        port: 3000,
        $env: {
          production: 'not-an-object',
        },
      },
      onDebug: (message: string) => {
        debugMessages.push(message);
      },
    } as never);

    expect(result!.config).toEqual({ port: 3000 });
    expect(debugMessages.some((m) => m.includes('$env'))).toBe(false);
  });

  it('hooks run in lifecycle order at boot', async () => {
    const order: string[] = [];

    const { result } = await setupTest({
      rootAsCwd: true,
      projectConfig: { port: 3000 },
      hooks: [
        {
          name: 'h1',
          lifecycle: 'before:global',
          load: () => {
            order.push('before:global');
            return {};
          },
        },
        {
          name: 'h2',
          lifecycle: 'after:project',
          load: () => {
            order.push('after:project');
            return {};
          },
        },
      ],
    });

    expect(result!.config).toEqual({ port: 3000 });
    expect(order).toEqual(['before:global', 'after:project']);
  });

  it('after:write hook registered, not called at boot', async () => {
    let isCalled = false;

    await setupTest({
      rootAsCwd: true,
      projectConfig: { port: 3000 },
      hooks: [
        {
          name: 'write-hook',
          lifecycle: 'after:write',
          load: () => {
            isCalled = true;
            return {};
          },
        },
      ],
    } as never);

    expect(isCalled).toBe(false);
  });

  it('hook returns null → deepMerge crashes (contract violation)', async () => {
    await expect(
      setupTest({
        rootAsCwd: true,
        projectConfig: { port: 3000 },
        hooks: [
          {
            name: 'null-hook',
            lifecycle: 'before:global',
            load: () => null,
          },
        ],
      } as never),
    ).rejects.toThrow();
  });
});
