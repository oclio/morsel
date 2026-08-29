import { clearWatcherRegistry, setupTest } from '@oclio/test-helpers';

describe('cascade-merge — merge behavior', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('nested objects are merged, not replaced', async () => {
    const { result } = await setupTest({
      reactive: false,
      globalConfig: {
        server: { host: '0.0.0.0', port: 8080 },
      },
      projectConfig: {
        server: { port: 3000, timeout: 5000 },
      },
      defaults: { server: { host: 'localhost', retries: 3 } },
    });

    const { config } = result!;

    expect(config).toEqual({
      server: { host: '0.0.0.0', port: 3000, timeout: 5000, retries: 3 },
    });
  });

  it('deep merge at arbitrary depth (4+ levels)', async () => {
    const { result } = await setupTest({
      reactive: false,
      projectConfig: {
        a: { b: { c: { e: 'project' } } },
      },
      defaults: { a: { b: { c: { d: 'defaults' } } } },
    });

    const { config } = result!;

    expect(config).toEqual({
      a: { b: { c: { d: 'defaults', e: 'project' } } },
    });
  });

  it('defaults < global < project < overrides priority', async () => {
    const { result } = await setupTest({
      reactive: false,
      globalConfig: {
        port: 8080,
        host: 'global.example.com',
      },
      projectConfig: {
        port: 3000,
        timeout: 5000,
      },
      defaults: { port: 4000, retries: 3 },
      overrides: { port: 9000, debug: true },
    });

    const { config } = result!;

    expect(config).toEqual({
      port: 9000,
      host: 'global.example.com',
      timeout: 5000,
      retries: 3,
      debug: true,
    });
  });

  it('null in a higher layer resets the key from lower layers', async () => {
    const { result } = await setupTest({
      reactive: false,
      globalConfig: {
        host: 'global.example.com',
        port: 8080,
      },
      projectConfig: {
        host: null,
        port: 3000,
      },
      defaults: { host: 'localhost', port: 4000, debug: true },
      overrides: { port: null },
    });

    const { config } = result!;

    expect(config).toEqual({ host: null, port: null, debug: true });
  });

  it.each([
    {
      name: 'defaults',
      defaults: { port: null },
      globalConfig: { port: 8080 },
      projectConfig: { port: 3000 },
      overrides: {},
      expected: { port: 3000 },
    },
    {
      name: 'global',
      defaults: { port: 4000 },
      globalConfig: { port: null },
      projectConfig: { port: 3000 },
      overrides: {},
      expected: { port: 3000 },
    },
    {
      name: 'project',
      defaults: { port: 4000 },
      globalConfig: { port: 8080 },
      projectConfig: { port: null },
      overrides: {},
      expected: { port: null },
    },
    {
      name: 'overrides',
      defaults: { port: 4000 },
      globalConfig: { port: 8080 },
      projectConfig: { port: 3000 },
      overrides: { port: null },
      expected: { port: null },
    },
  ])(
    'null overwrites from $name layer',
    async ({ defaults, globalConfig, projectConfig, overrides, expected }) => {
      const { result } = await setupTest({
        reactive: false,
        globalConfig,
        projectConfig,
        defaults,
        overrides,
      });

      const { config } = result!;

      expect(config).toEqual(expected);
    },
  );

  it('undefined in overrides does not overwrite, but other override keys do', async () => {
    const { result } = await setupTest({
      reactive: false,
      globalConfig: {
        host: 'global.example.com',
        port: 8080,
      },
      projectConfig: {
        port: 3000,
      },
      defaults: { port: 4000, host: 'localhost', retries: 3 },
      overrides: { port: 9000, host: undefined, debug: true },
    });

    const { config } = result!;

    expect(config).toEqual({
      port: 9000,
      host: 'global.example.com',
      retries: 3,
      debug: true,
    });
  });

  it.each([
    {
      name: 'defaults',
      defaults: { port: undefined },
      globalConfig: { port: 8080 },
      projectConfig: {},
      overrides: {},
      expected: { port: 8080 },
    },
    {
      name: 'global',
      defaults: { port: 4000 },
      globalConfig: { port: undefined },
      projectConfig: { port: 3000 },
      overrides: {},
      expected: { port: 3000 },
    },
    {
      name: 'project',
      defaults: { port: 4000 },
      globalConfig: { port: 8080 },
      projectConfig: { port: undefined },
      overrides: {},
      expected: { port: 8080 },
    },
    {
      name: 'overrides',
      defaults: { port: 4000 },
      globalConfig: { port: 8080 },
      projectConfig: { port: 3000 },
      overrides: { port: undefined },
      expected: { port: 3000 },
    },
  ])(
    'undefined ignored from $name layer',
    async ({ defaults, globalConfig, projectConfig, overrides, expected }) => {
      const { result } = await setupTest({
        reactive: false,
        globalConfig,
        projectConfig,
        defaults,
        overrides,
      });

      const { config } = result!;

      expect(config).toEqual(expected);
    },
  );

  it('object replaced by scalar — scalar wins', async () => {
    const { result } = await setupTest({
      reactive: false,
      projectConfig: {
        server: 'disabled',
      },
      defaults: { server: { host: 'localhost' } },
    });

    const { config } = result!;

    expect(config).toEqual({ server: 'disabled' });
  });

  it('scalar replaced by object — object wins', async () => {
    const { result } = await setupTest({
      reactive: false,
      projectConfig: {
        port: { value: 3000 },
      },
      defaults: { port: 3000 },
    });

    const { config } = result!;

    expect(config).toEqual({ port: { value: 3000 } });
  });

  it('scalar of different type — string wins over number', async () => {
    const { result } = await setupTest({
      reactive: false,
      projectConfig: {
        port: '3000',
      },
      defaults: { port: 3000 },
    });

    const { config } = result!;

    expect(config).toEqual({ port: '3000' });
  });

  it('array replaced by object — object wins', async () => {
    const { result } = await setupTest({
      reactive: false,
      projectConfig: {
        tags: { x: 1 },
      },
      defaults: { tags: ['a'] },
    });

    const { config } = result!;

    expect(config).toEqual({ tags: { x: 1 } });
  });

  it('object replaced by array — array wins', async () => {
    const { result } = await setupTest({
      reactive: false,
      projectConfig: {
        server: ['a', 'b'],
      },
      defaults: { server: { host: 'x' } },
    });

    const { config } = result!;

    expect(config).toEqual({ server: ['a', 'b'] });
  });

  it('array replaced by scalar — scalar wins', async () => {
    const { result } = await setupTest({
      reactive: false,
      projectConfig: {
        tags: 'none',
      },
      defaults: { tags: ['a'] },
    });

    const { config } = result!;

    expect(config).toEqual({ tags: 'none' });
  });

  it('key present in defaults only survives in final result', async () => {
    const { result } = await setupTest({
      reactive: false,
      defaults: { port: 3000, retries: 3 },
    });

    const { config } = result!;

    expect(config).toEqual({ port: 3000, retries: 3 });
  });

  it('key present in all 4 layers with different values — overrides wins', async () => {
    const { result } = await setupTest({
      reactive: false,
      globalConfig: {
        port: 8080,
      },
      projectConfig: {
        port: 3000,
      },
      defaults: { port: 4000 },
      overrides: { port: 9000 },
    });

    const { config } = result!;

    expect(config).toEqual({ port: 9000 });
  });
});
