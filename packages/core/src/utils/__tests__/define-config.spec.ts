import { defineConfig, mergeConfig } from '@/utils/define-config';

vi.mock('@/merge/deep-merge');

import { deepMerge } from '@/merge/deep-merge';

describe('defineConfig', () => {
  it('returns the same config object (identity)', () => {
    const config = {
      name: 'myapp',
      defaults: { port: 3000 },
    };

    const result = defineConfig(config);

    expect(result).toBe(config);
  });

  it('preserves all properties', () => {
    const config = {
      name: 'myapp',
      cwd: '/project',
      defaults: { port: 3000, host: 'localhost' },
      overrides: { port: 8080 },
      globalDir: '/global',
      arrayMerge: 'replace' as const,
      envName: 'production',
      configMutability: 'frozen' as const,
      verbose: true,
      watchDebounce: 500,
    };

    const result = defineConfig(config);

    expect(result).toEqual(config);
  });

  it('works with minimal config (name only)', () => {
    const config = { name: 'myapp' };

    const result = defineConfig(config);

    expect(result).toEqual({ name: 'myapp' });
  });

  it('works with empty defaults', () => {
    const config = { name: 'myapp', defaults: {} };

    const result = defineConfig(config);

    expect(result.defaults).toEqual({});
  });
});

describe('mergeConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(deepMerge).mockImplementation((base, override) => ({
      ...base,
      ...override,
    }));
  });

  it('spreads base and overrides at top level', () => {
    const base = { name: 'myapp', cwd: '/base' };
    const overrides = { cwd: '/override' };

    const result = mergeConfig(base, overrides);

    expect(result.name).toBe('myapp');
    expect(result.cwd).toBe('/override');
  });

  it('deep-merges defaults when both base and overrides have defaults', () => {
    const base = { name: 'myapp', defaults: { port: 3000, host: 'localhost' } };
    const overrides = { defaults: { port: 8080 } };

    const result = mergeConfig(base, overrides);

    expect(deepMerge).toHaveBeenCalledWith(
      { port: 3000, host: 'localhost' },
      { port: 8080 },
      'replace',
    );
    expect(result.defaults).toEqual({ port: 8080, host: 'localhost' });
  });

  it('uses overrides.defaults when base.defaults is undefined', () => {
    const base = { name: 'myapp' };
    const overrides = { defaults: { port: 8080 } };

    const result = mergeConfig(base, overrides);

    expect(deepMerge).not.toHaveBeenCalled();
    expect(result.defaults).toEqual({ port: 8080 });
  });

  it('uses base.defaults when overrides.defaults is undefined', () => {
    const base = { name: 'myapp', defaults: { port: 3000 } };
    const overrides = { cwd: '/override' };

    const result = mergeConfig(base, overrides);

    expect(deepMerge).not.toHaveBeenCalled();
    expect(result.defaults).toEqual({ port: 3000 });
  });

  it('deep-merges overrides when both base and overrides have overrides', () => {
    const base = {
      name: 'myapp',
      overrides: { port: 3000, host: 'localhost' },
    };
    const overrides = { overrides: { port: 8080 } };

    const result = mergeConfig(base, overrides);

    expect(deepMerge).toHaveBeenCalledWith(
      { port: 3000, host: 'localhost' },
      { port: 8080 },
      'replace',
    );
    expect(result.overrides).toEqual({ port: 8080, host: 'localhost' });
  });

  it('uses overrides.overrides when base.overrides is undefined', () => {
    const base = { name: 'myapp' };
    const overrides = { overrides: { port: 8080 } };

    const result = mergeConfig(base, overrides);

    expect(deepMerge).not.toHaveBeenCalled();
    expect(result.overrides).toEqual({ port: 8080 });
  });

  it('uses base.overrides when overrides.overrides is undefined', () => {
    const base = { name: 'myapp', overrides: { port: 3000 } };
    const overrides = { cwd: '/override' };

    const result = mergeConfig(base, overrides);

    expect(deepMerge).not.toHaveBeenCalled();
    expect(result.overrides).toEqual({ port: 3000 });
  });

  it('uses overrides.arrayMerge strategy when provided', () => {
    const base = {
      name: 'myapp',
      defaults: { items: [1, 2] },
      arrayMerge: 'replace' as const,
    };
    const overrides = {
      defaults: { items: [3] },
      arrayMerge: 'concat' as const,
    };

    mergeConfig(base, overrides);

    expect(deepMerge).toHaveBeenCalledWith(
      { items: [1, 2] },
      { items: [3] },
      'concat',
    );
  });

  it('uses base.arrayMerge strategy when overrides does not provide one', () => {
    const base = {
      name: 'myapp',
      defaults: { items: [1, 2] },
      arrayMerge: 'concat' as const,
    };
    const overrides = { defaults: { items: [3] } };

    mergeConfig(base, overrides);

    expect(deepMerge).toHaveBeenCalledWith(
      { items: [1, 2] },
      { items: [3] },
      'concat',
    );
  });

  it('defaults to replace strategy when neither provides arrayMerge', () => {
    const base = { name: 'myapp', defaults: { items: [1, 2] } };
    const overrides = { defaults: { items: [3] } };

    mergeConfig(base, overrides);

    expect(deepMerge).toHaveBeenCalledWith(
      { items: [1, 2] },
      { items: [3] },
      'replace',
    );
  });

  it('handles both defaults and overrides deep-merged simultaneously', () => {
    const base = {
      name: 'myapp',
      defaults: { port: 3000, host: 'localhost' },
      overrides: { port: 3000, host: 'localhost' },
    };
    const overrides = {
      defaults: { port: 8080, host: 'localhost' },
      overrides: { port: 3000, host: '0.0.0.0' },
    };

    const result = mergeConfig(base, overrides);

    expect(deepMerge).toHaveBeenCalledTimes(2);
    expect(result.defaults).toEqual({ port: 8080, host: 'localhost' });
    expect(result.overrides).toEqual({ port: 3000, host: '0.0.0.0' });
  });

  it('handles empty overrides object', () => {
    const base = { name: 'myapp', defaults: { port: 3000 } };

    const result = mergeConfig(base, {});

    expect(result.name).toBe('myapp');
    expect(result.defaults).toEqual({ port: 3000 });
  });

  it('handles neither base nor overrides having defaults or overrides objects', () => {
    const base = { name: 'myapp', cwd: '/base' };
    const overrides = { cwd: '/override' };

    const result = mergeConfig(base, overrides);

    expect(deepMerge).not.toHaveBeenCalled();
    expect(result.name).toBe('myapp');
    expect(result.cwd).toBe('/override');
    expect(Object.prototype.hasOwnProperty.call(result, 'defaults')).toBe(
      false,
    );
    expect(Object.prototype.hasOwnProperty.call(result, 'overrides')).toBe(
      false,
    );
  });
});
