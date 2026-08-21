import { jsonPlugin, resolvePaths } from '@/index';

describe('resolve-paths-custom-cwd — explicit cwd', () => {
  it('project path resolves within custom cwd', () => {
    const result = resolvePaths({ name: 'myapp', cwd: '/custom/dir' }, [
      jsonPlugin,
    ]);

    expect(result.project).toBe('/custom/dir/myapp.config.json');
  });
});
