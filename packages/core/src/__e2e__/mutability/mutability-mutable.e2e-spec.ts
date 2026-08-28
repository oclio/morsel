import { clearWatcherRegistry, setupTest } from '@oclio/test-helpers';

describe('mutability-mutable — mutable mode', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('mutable: config not frozen, can be modified', async () => {
    const { result } = await setupTest({
      reactive: false,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      configMutability: 'mutable',
    });

    expect(Object.isFrozen(result!.config)).toBe(false);

    const mutable = result!.config as Record<string, unknown>;
    mutable['port'] = 8080;
    expect(mutable['port']).toBe(8080);
  });

  it('mutable no Proxy: plain object, not a Proxy', async () => {
    const { result } = await setupTest({
      reactive: false,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      configMutability: 'mutable',
    });

    expect(Object.getPrototypeOf(result!.config)).toBe(Object.prototype);
  });

  it('mutable nested not frozen: nested objects are mutable', async () => {
    const { result } = await setupTest({
      reactive: false,
      projectConfig: { database: { host: 'localhost' } },
      createGlobalDir: true,
      configMutability: 'mutable',
    });

    const database = (result!.config as Record<string, unknown>)['database'];
    expect(Object.isFrozen(database)).toBe(false);

    const mutableDatabase = database as Record<string, unknown>;
    mutableDatabase['host'] = 'example.com';
    expect(mutableDatabase['host']).toBe('example.com');
  });
});
