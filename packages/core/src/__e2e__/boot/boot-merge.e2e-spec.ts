import { clearWatcherRegistry, setupTest } from '@oclio/morsel-e2e-helpers';

describe('boot-merge — merge + prototype protection', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('arrays are concatenated with arrayMerge: concat', async () => {
    const { result } = await setupTest({
      globalConfig: { tags: ['a', 'b'] },
      projectConfig: { tags: ['c', 'd'] },
      defaults: { tags: ['default'] },
      overrides: { tags: ['override'] },
      arrayMerge: 'concat',
    });

    expect(result!.config).toEqual({
      tags: ['default', 'a', 'b', 'c', 'd', 'override'],
    });
  });

  it('arrays are replaced, not concatenated', async () => {
    const { result } = await setupTest({
      globalConfig: { tags: ['a', 'b', 'c'] },
      projectConfig: { tags: ['x', 'y'] },
      defaults: { tags: ['default'] },
    });

    expect(result!.config).toEqual({ tags: ['x', 'y'] });
  });

  it('__proto__ key in config file silently skipped by deepMerge', async () => {
    const { result } = await setupTest({
      projectConfig: {
        __proto__: { polluted: true },
        port: 3000,
      } as never,
    });

    expect(result!.config).toEqual({ port: 3000 });
    expect((result!.config as Record<string, unknown>)['__proto__']).toBe(
      Object.prototype,
    );
    expect(Object.prototype).not.toHaveProperty('polluted');
  });

  it('literal dotted key in config file is not split into nested object', async () => {
    const { result } = await setupTest({
      projectConfig: { 'foo.bar': 123 },
    });

    expect(result!.config).toEqual({ 'foo.bar': 123 });
    expect(result!.config).not.toHaveProperty('foo');
  });
});
