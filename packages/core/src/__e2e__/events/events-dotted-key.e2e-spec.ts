import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('events-dotted-key — on("tools.eslint", cb) fires on nested change', () => {
  clearWatcherRegistry();

  it('dotted key listener fires when nested scalar changes', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { tools: { eslint: true, prettier: true } },
      createGlobalDir: true,
    });

    const events: { next: unknown; prev: unknown }[] = [];
    store!.on('tools.eslint', (next, prev) => {
      events.push({ next, prev });
    });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      tools: { eslint: false, prettier: true },
    });
    await waitForRemerge(store!, (config) => {
      const tools = (config as Record<string, unknown>)['tools'] as
        Record<string, unknown> | undefined;
      return tools?.['eslint'] === false;
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ next: false, prev: true });

    await store!.stop();
  });
});
