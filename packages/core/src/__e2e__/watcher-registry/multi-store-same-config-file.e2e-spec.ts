import { mkdir } from 'node:fs/promises';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('multi-store-same-config-file — 2 stores same name, same dir', () => {
  clearWatcherRegistry();

  it('ref-counting + independent events for same config file', async () => {
    const { directory } = await createTemporaryEnvironment();
    const projectDirectory = `${directory}/project`;

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });
    await mkdir(`${directory}/global`, { recursive: true });

    const store1 = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
    });
    const store2 = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: `${directory}/global`,
    });

    const events1: { next: unknown; prev: unknown }[] = [];
    const events2: { next: unknown; prev: unknown }[] = [];
    store1.on('port', (event) => {
      events1.push({ next: event.next, prev: event.prev });
    });
    store2.on('port', (event) => {
      events2.push({ next: event.next, prev: event.prev });
    });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await Promise.all([
      waitForRemerge(
        store1,
        (config) => (config as Record<string, unknown>)['port'] === 8080,
      ),
      waitForRemerge(
        store2,
        (config) => (config as Record<string, unknown>)['port'] === 8080,
      ),
    ]);

    expect(events1).toHaveLength(1);
    expect(events1[0]).toEqual({ next: 8080, prev: 3000 });
    expect(events2).toHaveLength(1);
    expect(events2[0]).toEqual({ next: 8080, prev: 3000 });

    await store1.stop();
    await store2.stop();
  });
});
