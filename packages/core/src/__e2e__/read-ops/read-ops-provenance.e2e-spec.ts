import { clearWatcherRegistry, setupTest } from '@oclio/morsel-e2e-helpers';

describe('read-ops-provenance — getProvenance() API', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('getProvenance(path): returns value, source, and file for a key from defaults', async () => {
    const { store } = await setupTest({
      defaults: { port: 3000 },
      createGlobalDir: true,
      watch: true,
    });

    const provenance = store!.getProvenance('port');

    expect(provenance).toBeDefined();
    expect(provenance?.value).toBe(3000);
    expect(provenance?.source).toBe('defaults');
    expect(provenance?.file).toBeUndefined();
    expect(provenance?.overridden).toEqual([]);

    await store!.stop();
  });

  it('getProvenance(path) on missing key: returns undefined', async () => {
    const { store } = await setupTest({
      defaults: { port: 3000 },
      createGlobalDir: true,
      watch: true,
    });

    expect(store!.getProvenance('missing')).toBeUndefined();
    expect(store!.getProvenance('server.host')).toBeUndefined();

    await store!.stop();
  });

  it('getProvenance after stop: still returns last known provenance', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 8080, host: '0.0.0.0' },
      defaults: { port: 3000 },
      createGlobalDir: true,
      watch: true,
    });

    expect(store!.getProvenance('port')?.value).toBe(8080);

    await store!.stop();

    const provenance = store!.getProvenance('port');

    expect(provenance).toBeDefined();
    expect(provenance?.value).toBe(8080);
    expect(provenance?.source).toBe('project');
    expect(provenance?.file).toBe(`${projectDirectory}/myapp.config.json`);
  });

  it('getProvenance: override chain across defaults, global, and project', async () => {
    const { store, projectDirectory, globalDirectory } = await setupTest({
      globalConfig: { port: 5000 },
      projectConfig: { port: 8080 },
      defaults: { port: 3000 },
      watch: true,
    });

    const provenance = store!.getProvenance('port');

    expect(provenance).toBeDefined();
    expect(provenance?.value).toBe(8080);
    expect(provenance?.source).toBe('project');
    expect(provenance?.file).toBe(`${projectDirectory}/myapp.config.json`);
    expect(provenance?.overridden).toHaveLength(2);

    expect(provenance?.overridden[0]).toEqual({
      value: 5000,
      source: 'global',
      file: `${globalDirectory}/myapp.config.json`,
    });
    expect(provenance?.overridden[1]).toEqual({
      value: 3000,
      source: 'defaults',
      file: undefined,
    });

    await store!.stop();
  });

  it('getProvenance: hook layer populates hookName', async () => {
    const { store } = await setupTest({
      defaults: { port: 3000 },
      createGlobalDir: true,
      watch: true,
      hooks: [
        {
          name: 'feature-flags',
          lifecycle: 'before:overrides' as const,
          load: () => ({ port: 4000 }),
        },
      ],
    });

    const provenance = store!.getProvenance('port');

    expect(provenance).toBeDefined();
    expect(provenance?.value).toBe(4000);
    expect(provenance?.source).toBe('hook');
    expect(provenance?.hookName).toBe('feature-flags');
    expect(provenance?.file).toBeUndefined();

    await store!.stop();
  });

  it('getProvenance on object key: returns full object, no recursive descent', async () => {
    const { store } = await setupTest({
      defaults: {
        server: { host: 'localhost', port: 3000 },
      },
      createGlobalDir: true,
      watch: true,
    });

    const provenance = store!.getProvenance('server');

    expect(provenance).toBeDefined();
    expect(provenance?.value).toEqual({ host: 'localhost', port: 3000 });
    expect(provenance?.source).toBe('defaults');
    expect(provenance?.overridden).toEqual([]);

    await store!.stop();
  });

  it('getProvenance on array key: returns full array, no per-index diff', async () => {
    const { store } = await setupTest({
      projectConfig: {
        tags: ['prod', 'eu-west'],
      },
      defaults: { tags: ['dev'] },
      createGlobalDir: true,
      watch: true,
    });

    const provenance = store!.getProvenance('tags');

    expect(provenance).toBeDefined();
    expect(provenance?.value).toEqual(['prod', 'eu-west']);
    expect(provenance?.source).toBe('project');
    expect(provenance?.overridden).toEqual([
      {
        value: ['dev'],
        source: 'defaults',
        file: undefined,
      },
    ]);

    await store!.stop();
  });
});
