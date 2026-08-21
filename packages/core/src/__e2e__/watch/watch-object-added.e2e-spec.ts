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
    store!.on('server', (next, prev) => {
      callOrder.push('server');
      expect(next).toEqual({ host: '0.0.0.0', port: 8080 });
      expect(prev).toBeUndefined();
    });
    store!.on('server.host', (next, prev) => {
      callOrder.push('server.host');
      expect(next).toBe('0.0.0.0');
      expect(prev).toBeUndefined();
    });
    store!.on('server.port', (next, prev) => {
      callOrder.push('server.port');
      expect(next).toBe(8080);
      expect(prev).toBeUndefined();
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
