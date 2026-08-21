import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('watch-object-removed — remove entire object', () => {
  clearWatcherRegistry();

  it('emits parent removed and children removed', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000, server: { host: '0.0.0.0', port: 8080 } },
      createGlobalDir: true,
    });

    const callOrder: string[] = [];
    store!.on('server', (next, prev) => {
      callOrder.push('server');
      expect(next).toBeUndefined();
      expect(prev).toEqual({ host: '0.0.0.0', port: 8080 });
    });
    store!.on('server.host', (next, prev) => {
      callOrder.push('server.host');
      expect(next).toBeUndefined();
      expect(prev).toBe('0.0.0.0');
    });
    store!.on('server.port', (next, prev) => {
      callOrder.push('server.port');
      expect(next).toBeUndefined();
      expect(prev).toBe(8080);
    });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });
    await waitForRemerge(store!, (config) => !('server' in config));

    expect(callOrder).toEqual(['server.port', 'server.host', 'server']);

    await store!.stop();
  });
});
