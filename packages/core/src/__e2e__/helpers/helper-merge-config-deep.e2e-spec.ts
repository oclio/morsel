import { mergeConfig } from '@/index';

describe('helper-merge-config-deep — deep merge of defaults', () => {
  it('deep merges defaults from base and overrides', () => {
    const base = {
      name: 'myapp',
      defaults: { port: 3000, server: { host: 'localhost', timeout: 5000 } },
    };

    const merged = mergeConfig(base, {
      defaults: { server: { timeout: 10_000 } } as Record<string, unknown>,
    } as never);

    expect(merged.defaults).toEqual({
      port: 3000,
      server: { host: 'localhost', timeout: 10_000 },
    });
  });
});
