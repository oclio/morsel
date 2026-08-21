import { jsonPlugin, mergeConfig } from '@/index';

describe('helper-merge-config-plugins-replaced — formatPlugins replaced not concat', () => {
  it('formatPlugins in overrides replaces base formatPlugins', () => {
    const customPlugin = {
      name: 'yaml',
      extensions: ['.yaml'],
      parse: () => ({}),
    };

    const base = {
      name: 'myapp',
      defaults: { port: 3000 },
      formatPlugins: [jsonPlugin],
    };

    const merged = mergeConfig(base, {
      formatPlugins: [customPlugin],
    } as never);

    expect(merged.formatPlugins).toEqual([customPlugin]);
    expect(merged.formatPlugins).not.toContain(jsonPlugin);
  });
});
