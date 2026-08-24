import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('mutability-mutable-deep-clone-diff — consumer mutation does not break diff', () => {
  clearWatcherRegistry();

  it('mutating config in mutable mode does not affect next re-merge diff', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });
    await mkdir(`${directory}/global`, { recursive: true });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
      configMutability: 'mutable',
    });

    const events: { next: unknown; prev: unknown }[] = [];
    store.on('port', (event) => {
      events.push({ next: event.next, prev: event.prev });
    });

    const mutable = store.config as Record<string, unknown>;
    mutable['port'] = 9999;

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(
      store,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ next: 8080, prev: 3000 });

    await store.stop();
  });
});
