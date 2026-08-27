import { clearWatcherRegistry, setupTest } from '@oclio/morsel-test-helpers';

describe('mutability-frozen — frozen mode (default)', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('frozen default: Object.isFrozen(config) is true', async () => {
    const { result } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    expect(Object.isFrozen(result!.config)).toBe(true);
  });

  it('frozen nested: recursive freeze, nested objects frozen', async () => {
    const { result } = await setupTest({
      projectConfig: { tools: { eslint: true, prettier: false } },
      createGlobalDir: true,
    });

    const tools = (result!.config as Record<string, unknown>)['tools'];
    expect(Object.isFrozen(tools)).toBe(true);
  });

  it('frozen mutation throws: assigning property throws in strict mode', async () => {
    const { result } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    expect(() => {
      (result!.config as Record<string, unknown>)['foo'] = 'bar';
    }).toThrow();
  });

  it('frozen delete blocked → TypeError', async () => {
    const { result } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    expect(() => {
      delete (result!.config as Record<string, unknown>)['port'];
    }).toThrow();
  });

  it('frozen arrays frozen: arrays in config are also frozen', async () => {
    const { result } = await setupTest({
      projectConfig: { items: ['a', 'b', 'c'] },
      createGlobalDir: true,
    });

    const items = (result!.config as Record<string, unknown>)['items'];
    expect(Array.isArray(items)).toBe(true);
    expect(Object.isFrozen(items)).toBe(true);
  });
});
