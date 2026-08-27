import { clearWatcherRegistry, setupTest } from '@oclio/morsel-test-helpers';

import { clearRegistry, getRegistry } from '@/index';

describe('edge-stop-all-stores-releases-registry — registry empty after all stop', () => {
  clearWatcherRegistry();

  it('all stores stopped → registry is empty', async () => {
    clearRegistry();

    const { store } = await setupTest({
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      watch: true,
    });

    expect(getRegistry().size).toBeGreaterThan(0);

    await store!.stop();

    expect(getRegistry().size).toBe(0);
  });
});
