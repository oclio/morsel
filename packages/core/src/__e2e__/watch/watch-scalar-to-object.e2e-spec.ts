import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('watch-scalar-to-object — {a:"val"} → {a:{b:1}}', () => {
  clearWatcherRegistry();

  it('emits a modified before a.b added (top-down)', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { a: 'val' },
      createGlobalDir: true,
    });

    const callOrder: string[] = [];
    store!.on('a', (event) => {
      callOrder.push('a');
      expect(event.next).toEqual({ b: 1 });
      expect(event.prev).toBe('val');
    });
    store!.on('a.b', (event) => {
      callOrder.push('a.b');
      expect(event.next).toBe(1);
      expect(event.prev).toBeUndefined();
    });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      a: { b: 1 },
    });
    await waitForRemerge(store!, (config) => {
      const a = (config as Record<string, unknown>)['a'] as
        Record<string, unknown> | undefined;
      return a?.['b'] === 1;
    });

    expect(callOrder).toEqual(['a', 'a.b']);

    await store!.stop();
  });
});
