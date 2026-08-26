import { homedir } from 'node:os';
import path from 'node:path';

import { jsonPlugin, resolvePaths } from '@/index';
import type { FormatPlugin } from '@/plugins/types';

describe('resolve-paths-basic — resolvePaths() API', () => {
  it('default: jsonPlugin → .json paths for global and project', () => {
    const result = resolvePaths({ name: 'myapp' }, [jsonPlugin]);

    expect(result.project).toBe(
      path.resolve(process.cwd(), 'myapp.config.json'),
    );
    expect(result.global).toBe(
      path.resolve(homedir(), '.config', 'myapp', 'myapp.config.json'),
    );
  });

  it('custom cwd: project path within custom cwd', () => {
    const result = resolvePaths({ name: 'myapp', cwd: '/custom/dir' }, [
      jsonPlugin,
    ]);

    expect(result.project).toBe('/custom/dir/myapp.config.json');
  });

  it('custom global dir: global path within custom globalDir', () => {
    const result = resolvePaths(
      { name: 'myapp', globalDir: '/custom/global' },
      [jsonPlugin],
    );

    expect(result.global).toBe(
      path.resolve('/custom/global', 'myapp.config.json'),
    );
  });

  it('multi plugin: first plugin extension used', () => {
    const yamlPlugin: FormatPlugin = {
      name: 'yaml',
      extensions: ['.yaml'],
      parse: () => ({}),
      serialize: () => '',
    };

    const result = resolvePaths({ name: 'myapp', cwd: '/project' }, [
      yamlPlugin,
      jsonPlugin,
    ]);

    expect(result.project).toBe('/project/myapp.config.yaml');
  });

  it('empty plugins → TypeError', () => {
    expect(() => resolvePaths({ name: 'myapp', cwd: '/project' }, [])).toThrow(
      TypeError,
    );
  });

  it('no io: paths returned without file access', () => {
    const result = resolvePaths(
      { name: 'nonexistent-app', cwd: '/nonexistent/dir' },
      [jsonPlugin],
    );

    expect(result.project).toBe('/nonexistent/dir/nonexistent-app.config.json');
    expect(result.global).toBeDefined();
  });

  it('resolvePaths returns first extension only', () => {
    const multiExtensionPlugin: FormatPlugin = {
      name: 'multi',
      extensions: ['.yaml', '.yml'],
      parse: () => ({}),
      serialize: () => '',
    };

    const result = resolvePaths({ name: 'myapp', cwd: '/project' }, [
      multiExtensionPlugin,
    ]);

    expect(result.project).toBe('/project/myapp.config.yaml');
  });

  it('resolvePaths does NOT check .config/ directory', () => {
    const result = resolvePaths({ name: 'myapp', cwd: '/project' }, [
      jsonPlugin,
    ]);

    expect(result.project).toBe('/project/myapp.config.json');
    expect(result.project).not.toContain('.config/');
  });

  it('cwd defaults to process.cwd()', () => {
    const result = resolvePaths({ name: 'myapp' }, [jsonPlugin]);

    expect(result.project).toBe(
      path.resolve(process.cwd(), 'myapp.config.json'),
    );
  });
});
