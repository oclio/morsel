import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('watch-object-nested-modified — deep scalar change', () => {
  clearWatcherRegistry();

  it('emits only on deepest flat key, not on parents', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { server: { db: { host: 'localhost', port: 5432 } } },
      createGlobalDir: true,
    });

    const callOrder: string[] = [];
    store!.on('server', () => {
      callOrder.push('server');
    });
    store!.on('server.db', () => {
      callOrder.push('server.db');
    });
    store!.on('server.db.host', (next, prev) => {
      callOrder.push('server.db.host');
      expect(next).toBe('0.0.0.0');
      expect(prev).toBe('localhost');
    });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      server: { db: { host: '0.0.0.0', port: 5432 } },
    });
    await waitForRemerge(store!, (config) => {
      const server = (config as Record<string, unknown>)['server'] as
        Record<string, unknown> | undefined;
      const db = server?.['db'] as Record<string, unknown> | undefined;
      return db?.['host'] === '0.0.0.0';
    });

    expect(callOrder).toEqual(['server.db.host']);

    store!.stop();
  });
});
