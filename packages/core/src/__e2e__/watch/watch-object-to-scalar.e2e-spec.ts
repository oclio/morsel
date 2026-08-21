import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('watch-object-to-scalar — {a:{b:1}} → {a:"val"}', () => {
  clearWatcherRegistry();

  it('emits a.b removed before a modified (bottom-up suppressions)', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { a: { b: 1 } },
      createGlobalDir: true,
    });

    const callOrder: string[] = [];
    store!.on('a', (next, prev) => {
      callOrder.push('a');
      expect(next).toBe('val');
      expect(prev).toEqual({ b: 1 });
    });
    store!.on('a.b', (next, prev) => {
      callOrder.push('a.b');
      expect(next).toBeUndefined();
      expect(prev).toBe(1);
    });

    await writeConfig(projectDirectory, 'myapp.config.json', { a: 'val' });
    await waitForRemerge(store!, (config) => config['a'] === 'val');

    expect(callOrder).toEqual(['a.b', 'a']);

    store!.stop();
  });
});
