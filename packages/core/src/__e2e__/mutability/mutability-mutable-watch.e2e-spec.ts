import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('mutability-mutable-watch — mutable + watch', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('mutable reference changes: new reference per re-merge', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      createGlobalDir: true,
      configMutability: 'mutable',
    });

    const referenceBefore = store!.config;

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(
      store!,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    const referenceAfter = store!.config;

    expect(referenceBefore).not.toBe(referenceAfter);
    expect(referenceAfter).toEqual({ port: 8080 });

    await store!.stop();
  });

  it('mutable deep clone diff: consumer mutation does not break diff', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      createGlobalDir: true,
      configMutability: 'mutable',
    });

    const events: { next: unknown; prev: unknown }[] = [];
    store!.on('port', (event) => {
      events.push({ next: event.next, prev: event.prev });
    });

    const mutable = store!.config as Record<string, unknown>;
    mutable['port'] = 9999;

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(
      store!,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ next: 8080, prev: 3000 });

    await store!.stop();
  });

  it('mutable after stop: config stays mutable and readable', async () => {
    const { store } = await setupTest({
      projectConfig: { port: 3000, host: 'localhost' },
      watch: true,
      createGlobalDir: true,
      configMutability: 'mutable',
    });

    expect(store!.config).toEqual({ port: 3000, host: 'localhost' });
    expect(Object.isFrozen(store!.config)).toBe(false);

    await store!.stop();

    expect(store!.config).toEqual({ port: 3000, host: 'localhost' });
    expect(Object.isFrozen(store!.config)).toBe(false);

    const mutated = store!.config as Record<string, unknown>;
    mutated['port'] = 9999;
    expect(mutated['port']).toBe(9999);
  });
});
