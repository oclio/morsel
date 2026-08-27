import { clearWatcherRegistry, setupTest } from '@oclio/test-helpers';

describe('mutability-frozen-after-stop — frozen after stop', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('frozen after stop: config frozen at last state, readable', async () => {
    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      createGlobalDir: true,
    });

    expect(store!.config).toEqual({ port: 3000 });

    await store!.stop();

    expect(Object.isFrozen(store!.config)).toBe(true);
    expect(store!.config).toEqual({ port: 3000 });
  });
});
