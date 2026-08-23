import { resolveEnv } from '@/load/resolve-env';
import { deepMerge } from '@/merge/deep-merge';
import { noop } from '@/store/assert-name';

vi.mock('@/merge/deep-merge', () => ({
  deepMerge: vi.fn(
    (base: Record<string, unknown>, override: Record<string, unknown>) => ({
      ...base,
      ...override,
    }),
  ),
}));

vi.mock('@/merge/merge-helpers', () => ({
  isPlainObject: vi.fn(
    (value: unknown): value is Record<string, unknown> =>
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype,
  ),
}));

describe('resolveEnv', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns config without $env when $env is absent', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const config = { foo: 'bar' };

    const result = resolveEnv(config, {
      envName: 'dev',
      onDebug: undefined,
    });

    expect(result).toEqual({ foo: 'bar' });
    expect(deepMerge).not.toHaveBeenCalled();
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('returns config without $env key when $env is undefined', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const config = { foo: 'bar', $env: undefined };

    const result = resolveEnv(config, {
      envName: 'dev',
      onDebug: undefined,
    });

    expect(result).toEqual({ foo: 'bar' });
    expect(deepMerge).not.toHaveBeenCalled();
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('logs to console.error when $env present but envName is undefined and no onDebug', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const config = { foo: 'bar', $env: { dev: { baz: 'qux' } } };

    const result = resolveEnv(config, {
      envName: undefined,
      onDebug: undefined,
    });

    expect(result).toEqual({ foo: 'bar' });
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy.mock.calls[0]?.[0]).toContain(
      '$env present but envName is undefined',
    );
  });

  it('routes to onDebug instead of stderr when onDebug is provided', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onDebug = vi.fn();
    const config = { foo: 'bar', $env: { dev: { baz: 'qux' } } };

    const result = resolveEnv(config, {
      envName: undefined,
      onDebug,
    });

    expect(result).toEqual({ foo: 'bar' });
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(onDebug).toHaveBeenCalledTimes(1);
    expect(onDebug.mock.calls[0]?.[0]).toContain(
      '$env present but envName is undefined',
    );
  });

  it('logs to console.error when onDebug is default noop', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const config = { foo: 'bar', $env: { dev: { baz: 'qux' } } };

    const result = resolveEnv(config, {
      envName: undefined,
      onDebug: noop,
    });

    expect(result).toEqual({ foo: 'bar' });
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy.mock.calls[0]?.[0]).toContain(
      '$env present but envName is undefined',
    );
  });

  it('logs to console.error when $env block is not a plain object and no onDebug', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const config = { foo: 'bar', $env: 'not-an-object' };

    const result = resolveEnv(config, {
      envName: 'dev',
      onDebug: undefined,
    });

    expect(result).toEqual({ foo: 'bar' });
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy.mock.calls[0]?.[0]).toContain(
      '$env block is not a plain object',
    );
  });

  it('routes to onDebug instead of stderr when $env block is not a plain object', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onDebug = vi.fn();
    const config = { foo: 'bar', $env: [1, 2, 3] };

    const result = resolveEnv(config, {
      envName: 'dev',
      onDebug,
    });

    expect(result).toEqual({ foo: 'bar' });
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(onDebug).toHaveBeenCalledTimes(1);
    expect(onDebug.mock.calls[0]?.[0]).toContain(
      '$env block is not a plain object',
    );
  });

  it('deep-merges env override when envName matches a plain object in $env', () => {
    const config = { foo: 'bar', $env: { dev: { baz: 'qux' } } };

    const result = resolveEnv(config, {
      envName: 'dev',
      onDebug: undefined,
    });

    expect(deepMerge).toHaveBeenCalledWith(
      { foo: 'bar' },
      { baz: 'qux' },
      'replace',
    );
    expect(result).toEqual({ foo: 'bar', baz: 'qux' });
  });

  it.each([
    {
      name: 'envName does not match any key in $env',
      config: { foo: 'bar', $env: { dev: { baz: 'qux' } } },
      envName: 'prod',
    },
    {
      name: 'envName matches a non-object value in $env',
      config: { foo: 'bar', $env: { dev: 'string-value' } },
      envName: 'dev',
    },
    {
      name: 'envName matches null in $env',
      config: { foo: 'bar', $env: { dev: null } },
      envName: 'dev',
    },
    {
      name: 'envName matches an array in $env',
      config: { foo: 'bar', $env: { dev: [1, 2, 3] } },
      envName: 'dev',
    },
  ])('returns config without override when $name', ({ config, envName }) => {
    const result = resolveEnv(config, {
      envName,
      onDebug: undefined,
    });

    expect(result).toEqual({ foo: 'bar' });
    expect(deepMerge).not.toHaveBeenCalled();
  });

  it('removes $env key from result even when env override is applied', () => {
    const config = { foo: 'bar', $env: { dev: { baz: 'qux' } } };

    const result = resolveEnv(config, {
      envName: 'dev',
      onDebug: undefined,
    });

    expect('$env' in result).toBe(false);
  });

  it('removes $env key from result when envName is undefined', () => {
    const config = { foo: 'bar', $env: { dev: { baz: 'qux' } } };

    const result = resolveEnv(config, {
      envName: undefined,
      onDebug: undefined,
    });

    expect('$env' in result).toBe(false);
  });

  it('removes $env key from result when $env block is not a plain object', () => {
    const config = { foo: 'bar', $env: 'bad' };

    const result = resolveEnv(config, {
      envName: 'dev',
      onDebug: undefined,
    });

    expect('$env' in result).toBe(false);
  });

  it('removes $env key re-introduced by env override after deep merge', () => {
    const config = { foo: 'bar', $env: { dev: { $env: 'nested' } } };

    const result = resolveEnv(config, {
      envName: 'dev',
      onDebug: undefined,
    });

    expect('$env' in result).toBe(false);
  });

  it('does not mutate the original config', () => {
    const config = { foo: 'bar', $env: { dev: { baz: 'qux' } } };

    resolveEnv(config, {
      envName: 'dev',
      onDebug: undefined,
    });

    expect(config).toEqual({ foo: 'bar', $env: { dev: { baz: 'qux' } } });
  });
});
