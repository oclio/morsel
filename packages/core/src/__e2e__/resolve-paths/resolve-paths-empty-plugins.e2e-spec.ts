import { resolvePaths } from '@/index';

describe('resolve-paths-empty-plugins — formatPlugins: [] throws TypeError', () => {
  it('empty formatPlugins array throws TypeError', () => {
    expect(() => resolvePaths({ name: 'myapp', cwd: '/project' }, [])).toThrow(
      TypeError,
    );
  });
});
