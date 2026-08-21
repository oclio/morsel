import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('events-no-wildcard — on("foo.*", cb) never fires', () => {
  clearWatcherRegistry();

  it('wildcard pattern does not match any key', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { foo: { bar: 1, baz: 2 } },
      createGlobalDir: true,
    });

    let calls = 0;
    store!.on('foo.*', () => {
      calls++;
    });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      foo: { bar: 3, baz: 2 },
    });
    await waitForRemerge(store!, (config) => {
      const foo = (config as Record<string, unknown>)['foo'] as
        Record<string, unknown> | undefined;
      return foo?.['bar'] === 3;
    });

    expect(calls).toBe(0);

    store!.stop();
  });
});
