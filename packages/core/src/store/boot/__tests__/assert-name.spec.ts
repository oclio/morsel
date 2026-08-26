import { resolveGlobalDirectory } from '@/paths/resolve-paths';
import { jsonPlugin } from '@/plugins/json-plugin';
import { resolveOptions } from '@/store/boot/assert-name';
import type { WatchOptions } from '@/store/types';

vi.mock('@/paths/resolve-paths', () => ({
  resolveGlobalDirectory: vi.fn(),
}));

describe('resolveOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, 'cwd').mockReturnValue('/fake/cwd');
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterEach(() => {
    vi.mocked(process.cwd).mockRestore();
  });

  it.each([
    { name: 'missing', options: {} as never },
    { name: 'empty string', options: { name: '' } },
    { name: 'not a string', options: { name: 123 } as never },
  ])('throws TypeError when name is $name', ({ options }) => {
    expect(() => resolveOptions(options)).toThrow('morsel: name is required');
  });

  it.each([
    { name: 'spaces', input: 'my app' },
    { name: 'starts with digit', input: '123app' },
    { name: 'starts with dash', input: '-app' },
    { name: 'starts with underscore', input: '_app' },
    { name: 'contains dot', input: 'my.app' },
  ])('throws TypeError when name contains $name', ({ input }) => {
    expect(() => resolveOptions({ name: input })).toThrow(
      'morsel: name must start with a letter',
    );
  });

  it('resolves with defaults for all optional fields', () => {
    vi.mocked(resolveGlobalDirectory).mockReturnValue('/fake/global');

    const result = resolveOptions({ name: 'myapp' });

    expect(result.name).toBe('myapp');
    expect(result.cwd).toBe('/fake/cwd');
    expect(result.defaults).toEqual({});
    expect(result.overrides).toEqual({});
    expect(result.globalDir).toBe('/fake/global');
    expect(result.arrayMerge).toBe('replace');
    expect(result.envName).toBe('test');
    expect(result.configMutability).toBe('frozen');
    expect(result.verbose).toBe(false);
    expect(result.onDebug).toBeInstanceOf(Function);
    expect(result.onDebug('test')).toBeUndefined();
    expect(result.formatPlugins).toEqual([jsonPlugin]);
    expect(result.validationPlugins).toEqual([]);
    expect(result.hooks).toEqual([]);
    expect(result.watch).toBe(true);
    expect(result.proxy).toBe(true);
    expect(result.queue).toBe(true);
  });

  it('defaults watch to true when not provided', () => {
    vi.mocked(resolveGlobalDirectory).mockReturnValue('/fake/global');

    const result = resolveOptions({ name: 'myapp' });

    expect(result.watch).toBe(true);
  });

  it('defaults proxy to true when not provided', () => {
    vi.mocked(resolveGlobalDirectory).mockReturnValue('/fake/global');

    const result = resolveOptions({ name: 'myapp' });

    expect(result.proxy).toBe(true);
  });

  it('defaults queue to true when not provided', () => {
    vi.mocked(resolveGlobalDirectory).mockReturnValue('/fake/global');

    const result = resolveOptions({ name: 'myapp' });

    expect(result.queue).toBe(true);
  });

  it('uses provided watch: false', () => {
    vi.mocked(resolveGlobalDirectory).mockReturnValue('/fake/global');

    const result = resolveOptions({
      name: 'myapp',
      watch: false,
    } as WatchOptions);

    expect(result.watch).toBe(false);
  });

  it('uses provided proxy: false', () => {
    vi.mocked(resolveGlobalDirectory).mockReturnValue('/fake/global');

    const result = resolveOptions({
      name: 'myapp',
      proxy: false,
    } as WatchOptions);

    expect(result.proxy).toBe(false);
  });

  it('uses provided queue: false', () => {
    vi.mocked(resolveGlobalDirectory).mockReturnValue('/fake/global');

    const result = resolveOptions({
      name: 'myapp',
      queue: false,
    } as WatchOptions);

    expect(result.queue).toBe(false);
  });

  it('uses provided formatPlugins and validationPlugins', () => {
    vi.mocked(resolveGlobalDirectory).mockReturnValue('/fake/global');

    const formatPlugins = [jsonPlugin];
    const validationPlugins = [
      { name: 'zod', validate: (c: Record<string, unknown>) => c },
    ];

    const result = resolveOptions({
      name: 'myapp',
      formatPlugins,
      validationPlugins,
    });

    expect(result.formatPlugins).toBe(formatPlugins);
    expect(result.validationPlugins).toBe(validationPlugins);
  });

  it('uses provided hooks', () => {
    vi.mocked(resolveGlobalDirectory).mockReturnValue('/fake/global');

    const hooks = [
      { name: 'env', lifecycle: 'before:defaults' as const, load: () => ({}) },
    ];

    const result = resolveOptions({ name: 'myapp', hooks });

    expect(result.hooks).toBe(hooks);
  });

  it('uses provided cwd over process.cwd()', () => {
    const result = resolveOptions({ name: 'myapp', cwd: '/custom/cwd' });

    expect(result.cwd).toBe('/custom/cwd');
  });

  it('uses provided defaults and overrides', () => {
    vi.mocked(resolveGlobalDirectory).mockReturnValue('/fake/global');

    const result = resolveOptions({
      name: 'myapp',
      defaults: { a: 1 },
      overrides: { b: 2 },
    });

    expect(result.defaults).toEqual({ a: 1 });
    expect(result.overrides).toEqual({ b: 2 });
  });

  it('uses provided globalDir over resolveGlobalDirectory', () => {
    vi.mocked(resolveGlobalDirectory).mockReturnValue('/fake/global');

    const result = resolveOptions({
      name: 'myapp',
      globalDir: '/custom/global',
    });

    expect(result.globalDir).toBe('/custom/global');
    expect(resolveGlobalDirectory).not.toHaveBeenCalled();
  });

  it('uses provided arrayMerge strategy', () => {
    vi.mocked(resolveGlobalDirectory).mockReturnValue('/fake/global');

    const result = resolveOptions({
      name: 'myapp',
      arrayMerge: 'concat',
    });

    expect(result.arrayMerge).toBe('concat');
  });

  it('uses provided envName over NODE_ENV', () => {
    vi.mocked(resolveGlobalDirectory).mockReturnValue('/fake/global');

    const result = resolveOptions({
      name: 'myapp',
      envName: 'production',
    });

    expect(result.envName).toBe('production');
  });

  it('uses undefined envName when NODE_ENV is not set', () => {
    vi.stubEnv('NODE_ENV', undefined);
    vi.mocked(resolveGlobalDirectory).mockReturnValue('/fake/global');

    const result = resolveOptions({ name: 'myapp' });

    expect(result.envName).toBeUndefined();
  });

  it('uses provided configMutability', () => {
    vi.mocked(resolveGlobalDirectory).mockReturnValue('/fake/global');

    const result = resolveOptions({
      name: 'myapp',
      configMutability: 'mutable',
    });

    expect(result.configMutability).toBe('mutable');
  });

  it('uses provided verbose flag', () => {
    vi.mocked(resolveGlobalDirectory).mockReturnValue('/fake/global');

    const result = resolveOptions({
      name: 'myapp',
      verbose: true,
    });

    expect(result.verbose).toBe(true);
  });

  it('uses provided onDebug callback', () => {
    vi.mocked(resolveGlobalDirectory).mockReturnValue('/fake/global');
    const onDebug = (): void => {};

    const result = resolveOptions({ name: 'myapp', onDebug });

    expect(result.onDebug).toBe(onDebug);
  });

  it('passes name to resolveGlobalDirectory', () => {
    vi.mocked(resolveGlobalDirectory).mockReturnValue('/fake/global');

    resolveOptions({ name: 'myapp' });

    expect(resolveGlobalDirectory).toHaveBeenCalledWith({ name: 'myapp' });
  });

  it.each([
    { name: 'with dash', input: 'my-app' },
    { name: 'with underscore', input: 'my_app' },
    { name: 'with dash and underscore', input: 'my-app_config' },
    { name: 'with digits', input: 'app2' },
    { name: 'mixed', input: 'my-app_v2' },
  ])('accepts name $name', ({ input }) => {
    vi.mocked(resolveGlobalDirectory).mockReturnValue('/fake/global');

    const result = resolveOptions({ name: input });

    expect(result.name).toBe(input);
  });

  // Explicit (non-parameterized) tests to kill regex mutants on VALID_NAME
  it('rejects "123app" — must start with letter (^ anchor)', () => {
    expect(() => resolveOptions({ name: '123app' })).toThrow(
      'morsel: name must start with a letter',
    );
  });

  it('rejects "myapp!" — must not contain trailing special char ($ anchor)', () => {
    expect(() => resolveOptions({ name: 'myapp!' })).toThrow(
      'morsel: name must start with a letter',
    );
  });

  it('accepts "myapp" — valid name with only letters', () => {
    vi.mocked(resolveGlobalDirectory).mockReturnValue('/fake/global');

    const result = resolveOptions({ name: 'myapp' });

    expect(result.name).toBe('myapp');
  });

  it('rejects "my!app" — must not contain special char in middle', () => {
    expect(() => resolveOptions({ name: 'my!app' })).toThrow(
      'morsel: name must start with a letter',
    );
  });

  it('accepts "myapp" with length > 2 — * quantifier allows multiple chars', () => {
    vi.mocked(resolveGlobalDirectory).mockReturnValue('/fake/global');

    const result = resolveOptions({ name: 'myapp' });

    expect(result.name).toBe('myapp');
  });
});
