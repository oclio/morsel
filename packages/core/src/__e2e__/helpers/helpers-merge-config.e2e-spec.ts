import { jsonPlugin, mergeConfig } from '@/index';

describe('helpers-merge-config — option composition', () => {
  it('deep merges defaults from base and overrides', () => {
    const base = {
      name: 'myapp',
      defaults: { port: 3000, server: { host: 'localhost', timeout: 5000 } },
    };

    const merged = mergeConfig(base, {
      defaults: { server: { timeout: 10_000 } } as Record<string, unknown>,
    } as never);

    expect(merged.defaults).toEqual({
      port: 3000,
      server: { host: 'localhost', timeout: 10_000 },
    });
  });

  it('name and cwd taken from base, overridden by overrides if present', () => {
    const base = {
      name: 'myapp',
      cwd: '/base/dir',
      defaults: { port: 3000 },
    };

    const merged1 = mergeConfig(base, {});
    expect(merged1.name).toBe('myapp');
    expect(merged1.cwd).toBe('/base/dir');

    const merged2 = mergeConfig(base, { name: 'otherapp', cwd: '/other/dir' });
    expect(merged2.name).toBe('otherapp');
    expect(merged2.cwd).toBe('/other/dir');
  });

  it('formatPlugins in overrides replaces base formatPlugins', () => {
    const customPlugin = {
      name: 'yaml',
      extensions: ['.yaml'],
      parse: () => ({}),
    };

    const base = {
      name: 'myapp',
      defaults: { port: 3000 },
      formatPlugins: [jsonPlugin],
    };

    const merged = mergeConfig(base, {
      formatPlugins: [customPlugin],
    } as never);

    expect(merged.formatPlugins).toEqual([customPlugin]);
    expect(merged.formatPlugins).not.toContain(jsonPlugin);
  });

  it('validationPlugins in overrides replaces base validationPlugins', () => {
    const baseValidator = {
      name: 'base',
      validate: (c: Record<string, unknown>) => c,
    };
    const overrideValidator = {
      name: 'override',
      validate: (c: Record<string, unknown>) => c,
    };

    const base = {
      name: 'myapp',
      defaults: { port: 3000 },
      validationPlugins: [baseValidator],
    };

    const merged = mergeConfig(base, {
      validationPlugins: [overrideValidator],
    } as never);

    expect(merged.validationPlugins).toEqual([overrideValidator]);
    expect(merged.validationPlugins).not.toContain(baseValidator);
  });

  it('hooks in overrides replaces base hooks', () => {
    const baseHook = {
      name: 'base-hook',
      lifecycle: 'before:defaults' as const,
      load: () => ({}),
    };
    const overrideHook = {
      name: 'override-hook',
      lifecycle: 'before:defaults' as const,
      load: () => ({}),
    };

    const base = {
      name: 'myapp',
      defaults: { port: 3000 },
      hooks: [baseHook],
    };

    const merged = mergeConfig(base, {
      hooks: [overrideHook],
    } as never);

    expect(merged.hooks).toEqual([overrideHook]);
    expect(merged.hooks).not.toContain(baseHook);
  });

  it('overrides field deep-merged like defaults', () => {
    const base = {
      name: 'myapp',
      overrides: { port: 3000, server: { host: 'localhost', timeout: 5000 } },
    };

    const merged = mergeConfig(base, {
      overrides: { server: { timeout: 10_000 } } as Record<string, unknown>,
    } as never);

    expect(merged.overrides).toEqual({
      port: 3000,
      server: { host: 'localhost', timeout: 10_000 },
    });
  });

  it('both defaults and overrides deep-merged simultaneously', () => {
    const base = {
      name: 'myapp',
      defaults: { port: 3000, server: { host: 'localhost' } },
      overrides: { timeout: 5000, server: { timeout: 5000 } },
    };

    const merged = mergeConfig(base, {
      defaults: { server: { host: '0.0.0.0' } } as Record<string, unknown>,
      overrides: { server: { timeout: 10_000 } } as Record<string, unknown>,
    } as never);

    expect(merged.defaults).toEqual({
      port: 3000,
      server: { host: '0.0.0.0' },
    });
    expect(merged.overrides).toEqual({
      timeout: 5000,
      server: { timeout: 10_000 },
    });
  });

  it('arrayMerge strategy from overrides takes priority', () => {
    const base = {
      name: 'myapp',
      defaults: { items: [1, 2] },
      arrayMerge: 'replace' as const,
    };

    const merged = mergeConfig(base, {
      defaults: { items: [3, 4] } as Record<string, unknown>,
      arrayMerge: 'concat' as const,
    } as never);

    expect(merged.arrayMerge).toBe('concat');
    expect(merged.defaults).toEqual({ items: [1, 2, 3, 4] });
  });

  it('arrayMerge strategy from base when overrides omits it', () => {
    const base = {
      name: 'myapp',
      defaults: { items: [1, 2] },
      arrayMerge: 'concat' as const,
    };

    const merged = mergeConfig(base, {
      defaults: { items: [3, 4] } as Record<string, unknown>,
    } as never);

    expect(merged.arrayMerge).toBe('concat');
    expect(merged.defaults).toEqual({ items: [1, 2, 3, 4] });
  });

  it('envName from base, overridden by overrides if present', () => {
    const base = {
      name: 'myapp',
      envName: 'ci',
      defaults: { port: 3000 },
    };

    const merged1 = mergeConfig(base, {});
    expect(merged1.envName).toBe('ci');

    const merged2 = mergeConfig(base, { envName: 'production' });
    expect(merged2.envName).toBe('production');
  });

  it('onDebug from base, overridden by overrides if present', () => {
    const baseDebug = () => {};
    const overrideDebug = () => {};

    const base = {
      name: 'myapp',
      onDebug: baseDebug,
      defaults: { port: 3000 },
    };

    const merged1 = mergeConfig(base, {});
    expect(merged1.onDebug).toBe(baseDebug);

    const merged2 = mergeConfig(base, { onDebug: overrideDebug });
    expect(merged2.onDebug).toBe(overrideDebug);
  });
});
