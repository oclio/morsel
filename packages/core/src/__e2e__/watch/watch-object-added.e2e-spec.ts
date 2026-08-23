import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('watch-object-added — add entire object', () => {
  clearWatcherRegistry();

  it('emits parent added and children added', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    const callOrder: string[] = [];
    store!.on('server', (event) => {
      callOrder.push('server');
      expect(event.next).toEqual({ host: '0.0.0.0', port: 8080 });
      expect(event.prev).toBeUndefined();
    });
    store!.on('server.host', (event) => {
      callOrder.push('server.host');
      expect(event.next).toBe('0.0.0.0');
      expect(event.prev).toBeUndefined();
    });
    store!.on('server.port', (event) => {
      callOrder.push('server.port');
      expect(event.next).toBe(8080);
      expect(event.prev).toBeUndefined();
    });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 3000,
      server: { host: '0.0.0.0', port: 8080 },
    });
    await waitForRemerge(store!, (config) => {
      const server = (config as Record<string, unknown>)['server'] as
        Record<string, unknown> | undefined;
      return server?.['port'] === 8080;
    });

    expect(callOrder).toEqual(['server', 'server.host', 'server.port']);

    await store!.stop();
  });
});
