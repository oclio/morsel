import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
} from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('edge-hooks-extends-env-combined — full pipeline', () => {
  clearWatcherRegistry();

  it('hooks + extends + $env combined → correct layers and config', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    mkdirSync(projectDirectory, { recursive: true });

    const baseConfigPath = path.resolve(projectDirectory, 'base.config.json');
    writeFileSync(baseConfigPath, JSON.stringify({ port: 3000 }), 'utf8');

    const projectConfigPath = path.resolve(
      projectDirectory,
      'myapp.config.json',
    );
    writeFileSync(
      projectConfigPath,
      JSON.stringify({
        extends: './base.config.json',
        $env: {
          development: { host: 'dev.example.com' },
          production: { host: 'prod.example.com' },
        },
      }),
      'utf8',
    );

    const hooks = [
      {
        name: 'info-hook',
        lifecycle: 'before:defaults' as const,
        load: () => ({ app: 'myapp' }),
      },
    ];

    const { config, layers } = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      hooks,
      envName: 'development',
    });

    expect(config).toEqual({
      app: 'myapp',
      port: 3000,
      host: 'dev.example.com',
    });

    expect(layers).toHaveLength(5);

    const [
      hookLayer,
      defaultsLayer,
      globalLayer,
      projectLayer,
      overridesLayer,
    ] = layers;

    expect(hookLayer!.source).toBe('hook');
    expect(hookLayer!.hookName).toBe('info-hook');
    expect(hookLayer!.exists).toBe(true);
    expect(hookLayer!.config).toEqual({ app: 'myapp' });

    expect(defaultsLayer!.source).toBe('defaults');
    expect(defaultsLayer!.exists).toBe(true);

    expect(globalLayer!.source).toBe('global');
    expect(globalLayer!.exists).toBe(false);

    expect(projectLayer!.source).toBe('project');
    expect(projectLayer!.exists).toBe(true);
    expect(projectLayer!.config).toEqual({
      port: 3000,
      host: 'dev.example.com',
    });
    expect(projectLayer!.config).not.toHaveProperty('$env');
    expect(projectLayer!.config).not.toHaveProperty('extends');

    expect(overridesLayer!.source).toBe('overrides');
    expect(overridesLayer!.exists).toBe(true);
  });
});
