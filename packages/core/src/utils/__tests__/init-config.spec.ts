import { mkdirSync, renameSync, writeFileSync } from 'node:fs';

import { MorselError } from '@/errors/error';
import { resolvePaths, resolveProjectPathSync } from '@/paths/resolve-paths';
import { jsonPlugin } from '@/plugins/json-plugin';
import { resolveOptions } from '@/store/assert-name';
import { initConfig } from '@/utils/init-config';

vi.mock('node:fs', () => ({
  mkdirSync: vi.fn(),
  renameSync: vi.fn(),
  writeFileSync: vi.fn(),
}));
vi.mock('@/paths/resolve-paths');
vi.mock('@/store/assert-name');

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
    vi.mocked(resolvePaths).mockReturnValue({
      global: '/global/myapp.config.json',
      project: '/project/myapp.config.json',
    });
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
      '/project/myapp.config.json.tmp',
      '{\n  "port": 8080\n}\n',
      'utf8',
    );
    expect(renameSync).toHaveBeenCalledWith(
      '/project/myapp.config.json.tmp',
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
      '/project/myapp.config.json.tmp',
      '{\n  "port": 3000,\n  "host": "localhost"\n}\n',
      'utf8',
    );
  });

  it('falls back to empty object when neither content nor fallbackContent provided', () => {
    mockResolved();
    vi.mocked(resolveProjectPathSync).mockReturnValue(undefined);

    initConfig({ name: 'myapp' });

    expect(writeFileSync).toHaveBeenCalledWith(
      '/project/myapp.config.json.tmp',
      '{}\n',
      'utf8',
    );
  });

  it('uses 2-space indent with trailing newline', () => {
    mockResolved();
    vi.mocked(resolveProjectPathSync).mockReturnValue(undefined);

    initConfig({
      name: 'myapp',
      content: { a: 1, b: { c: 2 } } as never,
    });

    expect(writeFileSync).toHaveBeenCalledWith(
      expect.any(String),
      '{\n  "a": 1,\n  "b": {\n    "c": 2\n  }\n}\n',
      'utf8',
    );
  });

  it('writes to tmp file then renames to final path (atomic write)', () => {
    mockResolved();
    vi.mocked(resolveProjectPathSync).mockReturnValue(undefined);

    initConfig({ name: 'myapp', content: { port: 8080 } as never });

    expect(writeFileSync).toHaveBeenCalledWith(
      '/project/myapp.config.json.tmp',
      expect.any(String),
      'utf8',
    );
    expect(renameSync).toHaveBeenCalledWith(
      '/project/myapp.config.json.tmp',
      '/project/myapp.config.json',
    );
  });

  it('creates parent directory with recursive: true', () => {
    mockResolved();
    vi.mocked(resolveProjectPathSync).mockReturnValue(undefined);
    vi.mocked(resolvePaths).mockReturnValue({
      global: '/global/myapp.config.json',
      project: '/project/nested/myapp.config.json',
    });

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

  it('handles JSON.stringify throwing by falling back to empty object', () => {
    mockResolved();
    vi.mocked(resolveProjectPathSync).mockReturnValue(undefined);

    const circular: Record<string, unknown> = {};
    circular['self'] = circular;

    initConfig({ name: 'myapp', content: circular as never });

    expect(writeFileSync).toHaveBeenCalledWith(
      '/project/myapp.config.json.tmp',
      '{}\n',
      'utf8',
    );
  });

  it('calls resolveOptions with provided options', () => {
    mockResolved();

    const options = { name: 'myapp', cwd: '/custom' };
    initConfig(options as never);

    expect(resolveOptions).toHaveBeenCalledWith(options);
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
