import { mergeConfig } from '@/index';

describe('helper-merge-config-options — name/cwd from base, overridden', () => {
  it('name and cwd taken from base, overridden by overrides if present', () => {
    const base = {
      name: 'myapp',
      cwd: '/base/dir',
      defaults: { port: 3000 },
    };

    const merged1 = mergeConfig(base, {});
    expect(merged1.name).toBe('myapp');
    expect(merged1.cwd).toBe('/base/dir');

    const merged2 = mergeConfig(base, { name: 'otherapp', cwd: '/other/dir' });
    expect(merged2.name).toBe('otherapp');
    expect(merged2.cwd).toBe('/other/dir');
  });
});
