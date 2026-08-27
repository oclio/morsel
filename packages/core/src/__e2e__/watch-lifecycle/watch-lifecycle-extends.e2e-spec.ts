import {
  assertRemerge,
  clearWatcherRegistry,
  setupTest,
  writeConfig,
} from '@oclio/test-helpers';

describe('watch-lifecycle-extends — extends directory watching', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('extends file modified: triggers re-merge via directory watcher', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { extends: './base.json', host: 'localhost' },
      extraConfigs: [{ filename: 'base.json', content: { port: 4000 } }],
      watch: true,
      createGlobalDir: true,
    });

    expect(store!.config).toEqual({ port: 4000, host: 'localhost' });

    await writeConfig(projectDirectory, 'base.json', { port: 8080 });
    await assertRemerge(store!, { port: 8080, host: 'localhost' });

    await store!.stop();
  });

  it('extends new directory: re-merge adds extends in new dir', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      createGlobalDir: true,
    });
    const subdirectory = `${projectDirectory}/sub`;

    expect(store!.config).toEqual({ port: 3000 });

    await writeConfig(subdirectory, 'base.json', { port: 4000 });
    await writeConfig(projectDirectory, 'myapp.config.json', {
      extends: './sub/base.json',
    });

    await assertRemerge(store!, { port: 4000 });

    await writeConfig(subdirectory, 'base.json', { port: 8080 });
    await assertRemerge(store!, { port: 8080 });

    await store!.stop();
  });

  it('extends removed directory: removing extends releases watcher', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { extends: './base.json' },
      extraConfigs: [{ filename: 'base.json', content: { port: 4000 } }],
      watch: true,
      createGlobalDir: true,
    });

    expect(store!.config).toEqual({ port: 4000 });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });
    await assertRemerge(store!, { port: 3000 });

    await writeConfig(projectDirectory, 'base.json', { port: 9999 });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(store!.config).toEqual({ port: 3000 });

    await store!.stop();
  });
});
