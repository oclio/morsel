import {
  clearWatcherRegistry,
  setupTest,
  writeConfig,
} from '@oclio/test-helpers';

import { loadConfig } from '@/index';

describe('hooks-cleanup — reserved key cleanup on hook output', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('$env and extends stripped from hook result', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });
    await writeConfig(projectDirectory, 'base.json', { baseKey: true });

    const previousNodeEnvironment = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'ci';

    try {
      const hooks = [
        {
          name: 'cleanup-hook',
          lifecycle: 'before:defaults' as const,
          load: () => ({
            $env: { ci: { envKey: 'ci-value' } },
            extends: './base.json',
            hookKey: 'val',
          }),
        },
      ];

      const { config, layers } = await loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        hooks,
      });

      expect(config).toEqual({
        envKey: 'ci-value',
        hookKey: 'val',
        port: 3000,
      });
      expect(config).not.toHaveProperty('extends');
      expect(config).not.toHaveProperty('$env');
      expect(config).not.toHaveProperty('baseKey');

      for (const layer of layers) {
        expect(layer.config).not.toHaveProperty('extends');
        expect(layer.config).not.toHaveProperty('$env');
      }
    } finally {
      if (previousNodeEnvironment === undefined) {
        delete process.env['NODE_ENV'];
      } else {
        process.env['NODE_ENV'] = previousNodeEnvironment;
      }
    }
  });

  it('hook output non-plain-object passed through as-is', async () => {
    const hooks = [
      {
        name: 'array-hook',
        lifecycle: 'before:defaults' as const,
        load: () => [1, 2, 3],
      },
    ];

    const { result } = await setupTest({
      reactive: false,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      hooks,
    } as never);

    const hookLayer = result!.layers.find((layer) => layer.source === 'hook');
    expect(hookLayer).toBeDefined();
    expect(hookLayer!.config).toEqual({ 0: 1, 1: 2, 2: 3 });
  });
});
