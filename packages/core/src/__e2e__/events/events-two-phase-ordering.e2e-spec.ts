import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('events-two-phase-ordering — removals bottom-up, additions top-down', () => {
  clearWatcherRegistry();

  it('removals fire deepest-first, additions fire shallowest-first', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { a: { b: 1, c: 2 } },
      createGlobalDir: true,
    });

    const callOrder: string[] = [];
    store!.on('a', () => {
      callOrder.push('a');
    });
    store!.on('a.b', () => {
      callOrder.push('a.b');
    });
    store!.on('a.c', () => {
      callOrder.push('a.c');
    });
    store!.on('a.d', () => {
      callOrder.push('a.d');
    });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      a: { d: 3 },
    });
    await waitForRemerge(store!, (config) => {
      const a = (config as Record<string, unknown>)['a'] as
        Record<string, unknown> | undefined;
      return a?.['d'] === 3;
    });

    const removals = callOrder.filter((k) => k === 'a.b' || k === 'a.c');
    const additions = callOrder.filter((k) => k === 'a.d');

    expect(removals).toContain('a.b');
    expect(removals).toContain('a.c');
    expect(additions).toContain('a.d');

    const firstRemovalIndex = Math.min(
      callOrder.indexOf('a.b'),
      callOrder.indexOf('a.c'),
    );
    const additionDIndex = callOrder.indexOf('a.d');
    expect(firstRemovalIndex).toBeLessThan(additionDIndex);

    await store!.stop();
  });
});
