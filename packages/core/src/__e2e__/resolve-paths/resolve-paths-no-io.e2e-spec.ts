import { jsonPlugin, resolvePaths } from '@/index';

describe('resolve-paths-no-io — paths returned without file access', () => {
  it('returns paths even when no files exist on disk', () => {
    const result = resolvePaths(
      { name: 'nonexistent-app', cwd: '/nonexistent/dir' },
      [jsonPlugin],
    );

    expect(result.project).toBe('/nonexistent/dir/nonexistent-app.config.json');
    expect(result.global).toBeDefined();
  });
});
