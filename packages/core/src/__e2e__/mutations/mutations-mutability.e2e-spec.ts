import {
  clearWatcherRegistry,
  setupTest,
  suppressConsoleError,
} from '@oclio/morsel-e2e-helpers';

describe('mutations-mutability — interaction with configMutability', () => {
  suppressConsoleError();

  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('set with configMutability: mutable — lastConfig is a clone', async () => {
    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      configMutability: 'mutable',
    });

    await store!.set('port', 8080);

    expect(store!.config).toEqual({ port: 8080 });

    const mutable = store!.config as Record<string, unknown>;
    mutable['port'] = 9999;

    expect(store!.config).toEqual({ port: 9999 });

    await store!.stop();
  });

  it('set with configMutability: frozen — lastConfig is same reference', async () => {
    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      configMutability: 'frozen',
    });

    const referenceBefore = store!.config;

    await store!.set('port', 8080);

    expect(store!.config).toEqual({ port: 8080 });

    const referenceAfter = store!.config;
    expect(referenceBefore).toBe(referenceAfter);

    await store!.stop();
  });
});
