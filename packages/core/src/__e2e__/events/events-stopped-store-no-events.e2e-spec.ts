import {
  clearWatcherRegistry,
  setupTest,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('events-stopped-store-no-events — stop() prevents future fires', () => {
  clearWatcherRegistry();

  it('after stop(), subsequent file changes do not emit events', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    let calls = 0;
    store!.on('port', () => {
      calls++;
    });

    await store!.stop();

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });

    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(calls).toBe(0);
  });
});
