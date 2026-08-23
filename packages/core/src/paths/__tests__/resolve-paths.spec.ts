import { existsSync } from 'node:fs';
import { access } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

import {
  resolveGlobalDirectory,
  resolveGlobalPath,
  resolveGlobalPathSync,
  resolvePaths,
  resolveProjectPath,
  resolveProjectPathSync,
} from '@/paths/resolve-paths';
import { jsonPlugin } from '@/plugins/json-plugin';
import type { MorselFormatPlugin } from '@/plugins/types';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  access: vi.fn(),
}));

vi.mock('node:os', () => ({
  homedir: vi.fn(),
}));

describe('resolveGlobalDirectory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('APPDATA', undefined);
    Object.defineProperty(process, 'platform', {
      value: 'linux',
      configurable: true,
    });
  });

  it('returns resolved explicit globalDir when provided', () => {
    const result = resolveGlobalDirectory({
      name: 'myapp',
      globalDir: '/custom/dir',
    });

    expect(result).toBe('/custom/dir');
    expect(homedir).not.toHaveBeenCalled();
  });

  it('returns resolved explicit globalDir with relative path', () => {
    const result = resolveGlobalDirectory({
      name: 'myapp',
      globalDir: 'relative/dir',
    });

    expect(result).toBe(path.resolve('relative/dir'));
  });

  it('falls back to homedir when globalDir is undefined', () => {
    vi.mocked(homedir).mockReturnValue('/home/user');

    const result = resolveGlobalDirectory({ name: 'myapp' });

    expect(result).toBe('/home/user/.config/myapp');
  });

  it('expands ~/ to homedir in globalDir', () => {
    vi.mocked(homedir).mockReturnValue('/home/user');

    const result = resolveGlobalDirectory({
      name: 'myapp',
      globalDir: '~/.morsel-test',
    });

    expect(result).toBe('/home/user/.morsel-test');
  });

  it('expands bare ~ to homedir in globalDir', () => {
    vi.mocked(homedir).mockReturnValue('/home/user');

    const result = resolveGlobalDirectory({
      name: 'myapp',
      globalDir: '~',
    });

    expect(result).toBe('/home/user');
  });

  it('falls back to homedir when globalDir is empty string', () => {
    vi.mocked(homedir).mockReturnValue('/home/user');

    const result = resolveGlobalDirectory({ name: 'myapp', globalDir: '' });

    expect(result).toBe('/home/user/.config/myapp');
  });

  it('uses APPDATA on Windows when globalDir is not set', () => {
    vi.stubEnv('APPDATA', 'C:\\AppData');
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      configurable: true,
    });

    const result = resolveGlobalDirectory({ name: 'myapp' });

    expect(result).toBe(path.resolve('C:\\AppData', 'myapp'));
    expect(homedir).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'undefined', appdata: undefined as string | undefined },
    { name: 'empty string', appdata: '' },
  ])(
    'falls back to homedir on Windows when APPDATA is $name',
    ({ appdata }) => {
      vi.stubEnv('APPDATA', appdata);
      vi.mocked(homedir).mockReturnValue('C:\\Users\\user');
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true,
      });

      const result = resolveGlobalDirectory({ name: 'myapp' });

      expect(result).toBe(path.resolve('C:\\Users\\user', '.config', 'myapp'));
    },
  );

  it('falls back to homedir on non-Windows when APPDATA is set', () => {
    vi.stubEnv('APPDATA', '/some/appdata');
    vi.mocked(homedir).mockReturnValue('/home/user');
    Object.defineProperty(process, 'platform', {
      value: 'linux',
      configurable: true,
    });

    const result = resolveGlobalDirectory({ name: 'myapp' });

    expect(result).toBe('/home/user/.config/myapp');
  });

  it('prioritizes globalDir over APPDATA on Windows', () => {
    vi.stubEnv('APPDATA', 'C:\\AppData');
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      configurable: true,
    });

    const result = resolveGlobalDirectory({
      name: 'myapp',
      globalDir: '/custom/dir',
    });

    expect(result).toBe('/custom/dir');
  });

  it('uses options.name in the default path, not hardcoded "morsel"', () => {
    vi.mocked(homedir).mockReturnValue('/home/user');

    const result = resolveGlobalDirectory({ name: 'otherapp' });

    expect(result).toBe('/home/user/.config/otherapp');
    expect(result).not.toContain('morsel');
  });
});

describe('resolveProjectPath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(access).mockResolvedValue(undefined);
  });

  it('uses explicit cwd when provided', async () => {
    const result = await resolveProjectPath(
      { name: 'myapp', cwd: '/project/dir' },
      [jsonPlugin],
    );

    expect(result).toBe('/project/dir/myapp.config.json');
  });

  it.each([
    { name: 'undefined', cwd: undefined as string | undefined },
    { name: 'empty string', cwd: '' },
  ])('falls back to process.cwd() when cwd is $name', async ({ cwd }) => {
    vi.spyOn(process, 'cwd').mockReturnValue('/current/dir');

    const result = await resolveProjectPath(
      { name: 'myapp', ...(cwd !== undefined && { cwd }) },
      [jsonPlugin],
    );

    expect(result).toBe('/current/dir/myapp.config.json');
    vi.mocked(process.cwd).mockRestore();
  });
});

describe('resolvePaths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('APPDATA', undefined);
    Object.defineProperty(process, 'platform', {
      value: 'linux',
      configurable: true,
    });
  });

  it('resolves both global and project paths', () => {
    vi.mocked(homedir).mockReturnValue('/home/user');
    vi.spyOn(process, 'cwd').mockReturnValue('/project');

    const result = resolvePaths({ name: 'myapp', cwd: '/project' }, [
      jsonPlugin,
    ]);

    expect(result.global).toBe('/home/user/.config/myapp/myapp.config.json');
    expect(result.project).toBe('/project/myapp.config.json');
    vi.mocked(process.cwd).mockRestore();
  });

  it('uses globalDir when provided', () => {
    const result = resolvePaths(
      {
        name: 'myapp',
        cwd: '/project',
        globalDir: '/custom/global',
      },
      [jsonPlugin],
    );

    expect(result.global).toBe('/custom/global/myapp.config.json');
    expect(result.project).toBe('/project/myapp.config.json');
  });

  it('throws TypeError when formatPlugins is empty', () => {
    expect(() => resolvePaths({ name: 'myapp', cwd: '/project' }, [])).toThrow(
      TypeError,
    );
    expect(() => resolvePaths({ name: 'myapp', cwd: '/project' }, [])).toThrow(
      'morsel: formatPlugins must not be empty',
    );
  });

  it('falls back to process.cwd() when cwd is undefined', () => {
    vi.mocked(homedir).mockReturnValue('/home/user');
    vi.spyOn(process, 'cwd').mockReturnValue('/current');

    const result = resolvePaths({ name: 'myapp' }, [jsonPlugin]);

    expect(result.project).toBe('/current/myapp.config.json');
    vi.mocked(process.cwd).mockRestore();
  });
});

describe('resolveProjectPath — not found', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(access).mockRejectedValue(new Error('ENOENT'));
  });

  it('returns undefined when no file exists', async () => {
    const result = await resolveProjectPath(
      { name: 'myapp', cwd: '/project' },
      [jsonPlugin],
    );

    expect(result).toBeUndefined();
  });
});

describe('resolveProjectPath — multi-plugin', () => {
  const yamlPlugin: MorselFormatPlugin = {
    name: 'yaml',
    extensions: ['.yaml', '.yml'],
    parse: () => ({}),
    serialize: () => '',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tries extensions in plugin order and returns first that exists', async () => {
    vi.mocked(access).mockImplementation((p: unknown) => {
      if (String(p).endsWith('.yaml')) {
        return Promise.resolve();
      }
      return Promise.reject(new Error('ENOENT'));
    });

    const result = await resolveProjectPath(
      { name: 'myapp', cwd: '/project' },
      [jsonPlugin, yamlPlugin],
    );

    expect(result).toBe('/project/myapp.config.yaml');
  });

  it('deduplicates extensions across plugins', async () => {
    const duplicatePlugin: MorselFormatPlugin = {
      name: 'json2',
      extensions: ['.json'],
      parse: () => ({}),
      serialize: () => '',
    };

    vi.mocked(access).mockRejectedValue(new Error('ENOENT'));

    await resolveProjectPath({ name: 'myapp', cwd: '/project' }, [
      jsonPlugin,
      duplicatePlugin,
    ]);

    expect(vi.mocked(access)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(access)).toHaveBeenCalledWith(
      '/project/myapp.config.json',
    );
  });

  it('throws TypeError when formatPlugins is empty', async () => {
    await expect(
      resolveProjectPath({ name: 'myapp', cwd: '/project' }, []),
    ).rejects.toThrow(TypeError);
  });
});

describe('resolveProjectPathSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns path when file exists', () => {
    vi.mocked(existsSync).mockReturnValue(true);

    const result = resolveProjectPathSync({ name: 'myapp', cwd: '/project' }, [
      jsonPlugin,
    ]);

    expect(result).toBe('/project/myapp.config.json');
  });

  it('returns undefined when no file exists', () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const result = resolveProjectPathSync({ name: 'myapp', cwd: '/project' }, [
      jsonPlugin,
    ]);

    expect(result).toBeUndefined();
  });

  it('throws TypeError when formatPlugins is empty', () => {
    expect(() =>
      resolveProjectPathSync({ name: 'myapp', cwd: '/project' }, []),
    ).toThrow(TypeError);
  });
});

describe('resolveGlobalPath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(homedir).mockReturnValue('/home/user');
  });

  it('returns path when global file exists', async () => {
    vi.mocked(access).mockResolvedValue(undefined);

    const result = await resolveGlobalPath({ name: 'myapp' }, [jsonPlugin]);

    expect(result).toBe('/home/user/.config/myapp/myapp.config.json');
  });

  it('returns undefined when no global file exists', async () => {
    vi.mocked(access).mockRejectedValue(new Error('ENOENT'));

    const result = await resolveGlobalPath({ name: 'myapp' }, [jsonPlugin]);

    expect(result).toBeUndefined();
  });

  it('throws TypeError when formatPlugins is empty', async () => {
    await expect(resolveGlobalPath({ name: 'myapp' }, [])).rejects.toThrow(
      TypeError,
    );
  });

  it('uses globalDir when provided', async () => {
    vi.mocked(access).mockResolvedValue(undefined);

    const result = await resolveGlobalPath(
      { name: 'myapp', globalDir: '/custom/global' },
      [jsonPlugin],
    );

    expect(result).toBe('/custom/global/myapp.config.json');
  });
});

describe('resolveGlobalPathSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(homedir).mockReturnValue('/home/user');
  });

  it('returns path when global file exists', () => {
    vi.mocked(existsSync).mockReturnValue(true);

    const result = resolveGlobalPathSync({ name: 'myapp' }, [jsonPlugin]);

    expect(result).toBe('/home/user/.config/myapp/myapp.config.json');
  });

  it('returns undefined when no global file exists', () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const result = resolveGlobalPathSync({ name: 'myapp' }, [jsonPlugin]);

    expect(result).toBeUndefined();
  });

  it('throws TypeError when formatPlugins is empty', () => {
    expect(() => resolveGlobalPathSync({ name: 'myapp' }, [])).toThrow(
      TypeError,
    );
  });
});
