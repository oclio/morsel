import { clearWatcherRegistry, setupTest } from '@oclio/morsel-e2e-helpers';

import { loadConfig, loadConfigSync } from '@/index';

describe('boot-parity — sync/async + concurrent', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('loadConfig and loadConfigSync produce identical config and layers for same input', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      globalConfig: { host: '0.0.0.0', features: { cache: true } },
      projectConfig: { port: 3000, features: { auth: true } },
    });

    const defaults = { port: 4000, host: 'localhost' };
    const overrides = { debug: true };

    const asyncResult = await loadConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults,
      overrides,
    });

    clearWatcherRegistry();

    const syncResult = loadConfigSync({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      defaults,
      overrides,
    });

    expect(asyncResult.config).toEqual(syncResult.config);
    expect(asyncResult.layers).toHaveLength(syncResult.layers.length);

    for (let index = 0; index < asyncResult.layers.length; index++) {
      const asyncLayer = asyncResult.layers[index]!;
      const syncLayer = syncResult.layers[index]!;

      expect(asyncLayer.source).toBe(syncLayer.source);
      expect(asyncLayer.exists).toBe(syncLayer.exists);
      expect(asyncLayer.config).toEqual(syncLayer.config);
      expect(asyncLayer.path).toBe(syncLayer.path);
    }
  });

  it('concurrent loadConfig via Promise.all loads multiple configs in parallel', async () => {
    const { projectDirectory, globalDirectory } = await setupTest({
      projectConfig: { port: 3000 },
    });

    const results = await Promise.all([
      loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        overrides: { tag: 'a' },
      }),
      loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        overrides: { tag: 'b' },
      }),
      loadConfig({
        name: 'myapp',
        cwd: projectDirectory,
        globalDir: globalDirectory,
        overrides: { tag: 'c' },
      }),
    ]);

    expect(results).toHaveLength(3);
    expect(results[0]!.config).toEqual({ port: 3000, tag: 'a' });
    expect(results[1]!.config).toEqual({ port: 3000, tag: 'b' });
    expect(results[2]!.config).toEqual({ port: 3000, tag: 'c' });
  });
});
