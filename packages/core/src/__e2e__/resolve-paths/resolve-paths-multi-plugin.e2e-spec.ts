import { jsonPlugin, resolvePaths } from '@/index';

describe('resolve-paths-multi-plugin — first plugin determines extension', () => {
  it('first plugin extension used for returned paths', () => {
    const yamlPlugin = {
      name: 'yaml',
      extensions: ['.yaml'],
      parse: () => ({}),
    };

    const result = resolvePaths({ name: 'myapp', cwd: '/project' }, [
      yamlPlugin,
      jsonPlugin,
    ]);

    expect(result.project).toBe('/project/myapp.config.yaml');
  });
});
