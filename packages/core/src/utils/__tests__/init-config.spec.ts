import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';

import { MorselError } from '@/errors/error';
import { resolveProjectPathSync } from '@/paths/resolve-paths';
import { jsonPlugin } from '@/plugins/json-plugin';
import { resolveOptions } from '@/store/boot/assert-name';
import { initConfig } from '@/utils/init-config';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  renameSync: vi.fn(),
  writeFileSync: vi.fn(),
}));
vi.mock('@/paths/resolve-paths');
vi.mock('@/store/boot/assert-name');

function mockResolved(overrides: Record<string, unknown> = {}) {
  const resolved = {
    name: 'myapp',
    cwd: '/project',
    defaults: { port: 3000 },
    overrides: {},
    globalDir: '/global',
    arrayMerge: 'replace' as const,
    envName: 'test',
    configMutability: 'frozen' as const,
    verbose: false,
    onDebug: vi.fn(),
    watchDebounce: 300,
    formatPlugins: [jsonPlugin],
    ...overrides,
  };
  vi.mocked(resolveOptions).mockReturnValue(resolved as never);
  return resolved;
}

describe('initConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mkdirSync).mockImplementation(() => undefined);
    vi.mocked(writeFileSync).mockImplementation(() => undefined);
    vi.mocked(renameSync).mockImplementation(() => undefined);
    vi.mocked(resolveProjectPathSync).mockReturnValue(
      '/project/myapp.config.json',
    );
    vi.mocked(existsSync).mockReturnValue(false);
  });

  it('returns existing path without writing when file exists', () => {
    mockResolved();

    const result = initConfig({ name: 'myapp' });

    expect(result).toBe('/project/myapp.config.json');
    expect(mkdirSync).not.toHaveBeenCalled();
    expect(writeFileSync).not.toHaveBeenCalled();
    expect(renameSync).not.toHaveBeenCalled();
  });

  it('writes content when provided and file does not exist', () => {
    mockResolved();
    vi.mocked(resolveProjectPathSync).mockReturnValue(undefined);

    const result = initConfig({
      name: 'myapp',
      content: { port: 8080 } as never,
    });

    expect(result).toBe('/project/myapp.config.json');
    expect(mkdirSync).toHaveBeenCalledWith('/project', { recursive: true });
    expect(writeFileSync).toHaveBeenCalledWith(
      expect.stringMatching(/^\/project\/myapp\.config\.json\.tmp\.\d+$/),
      jsonPlugin.serialize({ port: 8080 }),
      'utf8',
    );
    expect(renameSync).toHaveBeenCalledWith(
      expect.stringMatching(/^\/project\/myapp\.config\.json\.tmp\.\d+$/),
      '/project/myapp.config.json',
    );
  });

  it('falls back to fallbackContent when content is not provided', () => {
    mockResolved();
    vi.mocked(resolveProjectPathSync).mockReturnValue(undefined);

    initConfig({
      name: 'myapp',
      fallbackContent: { port: 3000, host: 'localhost' } as never,
    });

    expect(writeFileSync).toHaveBeenCalledWith(
      expect.stringMatching(/^\/project\/myapp\.config\.json\.tmp\.\d+$/),
      jsonPlugin.serialize({ port: 3000, host: 'localhost' }),
      'utf8',
    );
  });

  it('falls back to empty object when neither content nor fallbackContent provided', () => {
    mockResolved();
    vi.mocked(resolveProjectPathSync).mockReturnValue(undefined);

    initConfig({ name: 'myapp' });

    expect(writeFileSync).toHaveBeenCalledWith(
      expect.stringMatching(/^\/project\/myapp\.config\.json\.tmp\.\d+$/),
      jsonPlugin.serialize({}),
      'utf8',
    );
  });

  it('uses the first format plugin serialize method for output', () => {
    mockResolved();
    vi.mocked(resolveProjectPathSync).mockReturnValue(undefined);

    initConfig({
      name: 'myapp',
      content: { a: 1, b: { c: 2 } } as never,
    });

    expect(writeFileSync).toHaveBeenCalledWith(
      expect.any(String),
      jsonPlugin.serialize({ a: 1, b: { c: 2 } }),
      'utf8',
    );
  });

  it('writes to tmp file then renames to final path (atomic write)', () => {
    mockResolved();
    vi.mocked(resolveProjectPathSync).mockReturnValue(undefined);

    initConfig({ name: 'myapp', content: { port: 8080 } as never });

    expect(writeFileSync).toHaveBeenCalledWith(
      expect.stringMatching(/^\/project\/myapp\.config\.json\.tmp\.\d+$/),
      expect.any(String),
      'utf8',
    );
    expect(renameSync).toHaveBeenCalledWith(
      expect.stringMatching(/^\/project\/myapp\.config\.json\.tmp\.\d+$/),
      '/project/myapp.config.json',
    );
  });

  it('creates parent directory with recursive: true', () => {
    mockResolved({ cwd: '/project/nested' });
    vi.mocked(resolveProjectPathSync).mockReturnValue(undefined);
    vi.mocked(existsSync).mockReturnValue(false);

    initConfig({ name: 'myapp', content: {} as never });

    expect(mkdirSync).toHaveBeenCalledWith('/project/nested', {
      recursive: true,
    });
  });

  it('throws MorselError on mkdirSync failure', () => {
    mockResolved();
    vi.mocked(resolveProjectPathSync).mockReturnValue(undefined);
    const error = new Error('permission denied');
    vi.mocked(mkdirSync).mockImplementation(() => {
      throw error;
    });

    expect(() => initConfig({ name: 'myapp', content: {} as never })).toThrow(
      MorselError,
    );
  });

  it('throws MorselError with code EIO on mkdirSync failure', () => {
    mockResolved();
    vi.mocked(resolveProjectPathSync).mockReturnValue(undefined);
    const error = new Error('permission denied');
    vi.mocked(mkdirSync).mockImplementation(() => {
      throw error;
    });

    let caught: MorselError | undefined;
    try {
      initConfig({ name: 'myapp', content: {} as never });
    } catch (error_) {
      caught = error_ as MorselError;
    }

    expect(caught?.code).toBe('EIO');
  });

  it('throws MorselError on writeFileSync failure', () => {
    mockResolved();
    vi.mocked(resolveProjectPathSync).mockReturnValue(undefined);
    const error = new Error('disk full');
    vi.mocked(writeFileSync).mockImplementation(() => {
      throw error;
    });

    expect(() => initConfig({ name: 'myapp', content: {} as never })).toThrow(
      MorselError,
    );
  });

  it('throws MorselError with code EIO on writeFileSync failure', () => {
    mockResolved();
    vi.mocked(resolveProjectPathSync).mockReturnValue(undefined);
    const error = new Error('disk full');
    vi.mocked(writeFileSync).mockImplementation(() => {
      throw error;
    });

    let caught: MorselError | undefined;
    try {
      initConfig({ name: 'myapp', content: {} as never });
    } catch (error_) {
      caught = error_ as MorselError;
    }

    expect(caught?.code).toBe('EIO');
  });

  it('throws MorselError on renameSync failure', () => {
    mockResolved();
    vi.mocked(resolveProjectPathSync).mockReturnValue(undefined);
    const error = new Error('rename failed');
    vi.mocked(renameSync).mockImplementation(() => {
      throw error;
    });

    expect(() => initConfig({ name: 'myapp', content: {} as never })).toThrow(
      MorselError,
    );
  });

  it('throws MorselError with code EIO on renameSync failure', () => {
    mockResolved();
    vi.mocked(resolveProjectPathSync).mockReturnValue(undefined);
    const error = new Error('rename failed');
    vi.mocked(renameSync).mockImplementation(() => {
      throw error;
    });

    let caught: MorselError | undefined;
    try {
      initConfig({ name: 'myapp', content: {} as never });
    } catch (error_) {
      caught = error_ as MorselError;
    }

    expect(caught?.code).toBe('EIO');
  });

  it('throws MorselError with EWRITE when plugin.serialize throws', () => {
    mockResolved();
    vi.mocked(resolveProjectPathSync).mockReturnValue(undefined);

    const circular: Record<string, unknown> = {};
    circular['self'] = circular;

    let caught: MorselError | undefined;
    try {
      initConfig({ name: 'myapp', content: circular as never });
    } catch (error) {
      caught = error as MorselError;
    }

    expect(caught).toBeInstanceOf(MorselError);
    expect(caught?.code).toBe('EWRITE');
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it('wraps non-Error throws from plugin.serialize into Error', () => {
    const throwingPlugin = {
      name: 'throwing',
      extensions: ['.json'],
      parse: () => ({}),
      serialize: () => {
        throw 'string error';
      },
    };
    mockResolved({ formatPlugins: [throwingPlugin] });
    vi.mocked(resolveProjectPathSync).mockReturnValue(undefined);

    let caught: MorselError | undefined;
    try {
      initConfig({ name: 'myapp', content: {} as never });
    } catch (error) {
      caught = error as MorselError;
    }

    expect(caught).toBeInstanceOf(MorselError);
    expect(caught?.code).toBe('EWRITE');
    expect(caught?.cause).toBeInstanceOf(Error);
    expect((caught?.cause as Error).message).toBe('string error');
  });

  it('calls resolveOptions with provided options', () => {
    mockResolved();

    const options = { name: 'myapp', cwd: '/custom' };
    initConfig(options as never);

    expect(resolveOptions).toHaveBeenCalledWith(options);
  });

  it('writes to .config/ directory when it already exists', () => {
    mockResolved();
    vi.mocked(resolveProjectPathSync).mockReturnValue(undefined);
    vi.mocked(existsSync).mockReturnValue(true);

    const result = initConfig({
      name: 'myapp',
      content: { port: 8080 } as never,
    });

    expect(result).toBe('/project/.config/myapp.json');
    expect(mkdirSync).toHaveBeenCalledWith('/project/.config', {
      recursive: true,
    });
    expect(writeFileSync).toHaveBeenCalledWith(
      expect.stringMatching(/^\/project\/\.config\/myapp\.json\.tmp\.\d+$/),
      jsonPlugin.serialize({ port: 8080 }),
      'utf8',
    );
    expect(renameSync).toHaveBeenCalledWith(
      expect.stringMatching(/^\/project\/\.config\/myapp\.json\.tmp\.\d+$/),
      '/project/.config/myapp.json',
    );
  });

  it('writes to project root when .config/ does not exist', () => {
    mockResolved();
    vi.mocked(resolveProjectPathSync).mockReturnValue(undefined);
    vi.mocked(existsSync).mockReturnValue(false);

    const result = initConfig({
      name: 'myapp',
      content: { port: 8080 } as never,
    });

    expect(result).toBe('/project/myapp.config.json');
  });

  it('falls back to process.cwd() when cwd is undefined', () => {
    mockResolved({ cwd: undefined });
    vi.mocked(resolveProjectPathSync).mockReturnValue(undefined);
    vi.mocked(existsSync).mockReturnValue(false);
    vi.spyOn(process, 'cwd').mockReturnValue('/fallback-dir');

    const result = initConfig({ name: 'myapp', content: {} as never });

    expect(result).toBe('/fallback-dir/myapp.config.json');
    vi.mocked(process.cwd).mockRestore();
  });

  it('falls back to .json extension when formatPlugins is empty', () => {
    const emptyPlugin = {
      name: 'empty',
      extensions: [],
      parse: () => ({}),
      serialize: () => '',
    };
    mockResolved({ formatPlugins: [emptyPlugin] });
    vi.mocked(resolveProjectPathSync).mockReturnValue(undefined);
    vi.mocked(existsSync).mockReturnValue(false);

    const result = initConfig({ name: 'myapp', content: {} as never });

    expect(result).toBe('/project/myapp.config.json');
  });

  it('uses the first plugin extension and serialize for the written file', () => {
    const yamlPlugin = {
      name: 'yaml',
      extensions: ['.yaml', '.yml'],
      parse: () => ({}),
      serialize: (data: Record<string, unknown>) =>
        `# yaml\n${JSON.stringify(data)}`,
    };
    mockResolved({ formatPlugins: [yamlPlugin] });
    vi.mocked(resolveProjectPathSync).mockReturnValue(undefined);
    vi.mocked(existsSync).mockReturnValue(false);

    const result = initConfig({
      name: 'myapp',
      content: { port: 8080 } as never,
    });

    expect(result).toBe('/project/myapp.config.yaml');
    expect(writeFileSync).toHaveBeenCalledWith(
      expect.stringMatching(/^\/project\/myapp\.config\.yaml\.tmp\.\d+$/),
      '# yaml\n{"port":8080}',
      'utf8',
    );
  });

  it('throws TypeError when formatPlugins is empty', () => {
    mockResolved({ formatPlugins: [] });
    vi.mocked(resolveProjectPathSync).mockReturnValue(undefined);

    expect(() => initConfig({ name: 'myapp' })).toThrow(
      'morsel: formatPlugins must not be empty',
    );
  });

  it('calls resolveProjectPathSync with resolved options', () => {
    const resolved = mockResolved();

    initConfig({ name: 'myapp' });

    expect(resolveProjectPathSync).toHaveBeenCalledWith(
      resolved,
      expect.any(Array),
    );
  });
});
