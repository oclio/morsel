import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('watch-lifecycle-registry — watcher registry & multi-store', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('ref counting: stop() of first does not close watcher, second does', async () => {
    const {
      store: store1,
      projectDirectory,
      globalDirectory,
    } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      createGlobalDir: true,
    });
    const store2 = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await store1!.stop();

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(
      store2,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    expect(store2.config).toEqual({ port: 8080 });

    await store2.stop();
  });

  it('multi-store same config file: ref-counting + independent events', async () => {
    const {
      store: store1,
      projectDirectory,
      globalDirectory,
    } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      createGlobalDir: true,
    });
    const store2 = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    const events1: { next: unknown; prev: unknown }[] = [];
    const events2: { next: unknown; prev: unknown }[] = [];
    store1!.on('port', (event) => {
      events1.push({ next: event.next, prev: event.prev });
    });
    store2.on('port', (event) => {
      events2.push({ next: event.next, prev: event.prev });
    });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await Promise.all([
      waitForRemerge(
        store1!,
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

    await store1!.stop();
    await store2.stop();
  });

  it('multi-store different files: same dir, different names, no cross-fire', async () => {
    const {
      store: store1,
      projectDirectory,
      globalDirectory,
    } = await setupTest({
      name: 'app1',
      projectFilename: 'app1.config.json',
      projectConfig: { port: 3000 },
      extraConfigs: [{ filename: 'app2.config.json', content: { port: 8080 } }],
      watch: true,
      createGlobalDir: true,
    });
    const store2 = await watchConfig({
      name: 'app2',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    expect(store1!.config).toEqual({ port: 3000 });
    expect(store2.config).toEqual({ port: 8080 });

    await writeConfig(projectDirectory, 'app1.config.json', { port: 4000 });

    await waitForRemerge(
      store1!,
      (config) => (config as Record<string, unknown>)['port'] === 4000,
    );

    expect(store1!.config).toEqual({ port: 4000 });
    expect(store2.config).toEqual({ port: 8080 });

    await store1!.stop();
    await store2.stop();
  });

  it('multi-store same dir: independent debounce', async () => {
    const {
      store: store1,
      projectDirectory,
      globalDirectory,
    } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      createGlobalDir: true,
      watchDebounce: 50,
    });
    const store2 = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      watchDebounce: 200,
    });

    let store1FiredAt = 0;
    let store2FiredAt = 0;
    store1!.on('port', () => {
      store1FiredAt = Date.now();
    });
    store2.on('port', () => {
      store2FiredAt = Date.now();
    });

    const writeTime = Date.now();
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });

    await waitForRemerge(
      store1!,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );
    await waitForRemerge(
      store2,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    expect(store1!.config).toEqual({ port: 8080 });
    expect(store2.config).toEqual({ port: 8080 });
    expect(store1FiredAt).toBeGreaterThan(writeTime);
    expect(store2FiredAt).toBeGreaterThan(writeTime);
    expect(store1FiredAt).toBeLessThan(store2FiredAt);

    await store1!.stop();
    await store2.stop();
  });

  it('directory deleted: rm -rf watched dir → no crash, config frozen', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      createGlobalDir: true,
      defaults: { port: 4000 },
      onDebug: () => {},
    });

    await rm(projectDirectory, { recursive: true, force: true });
    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(store!.config).toEqual({ port: 3000 });

    await store!.stop();
  });

  it('directory recreated: delete then recreate → re-attach', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      createGlobalDir: true,
      defaults: { port: 4000 },
      onDebug: () => {},
    });

    await rm(projectDirectory, { recursive: true, force: true });
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await mkdir(projectDirectory, { recursive: true });
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });

    await waitForRemerge(
      store!,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    expect(store!.config).toEqual({ port: 8080 });

    await store!.stop();
  });

  it('rollback preserves watchers: parse error keeps watchers, recovery works', async () => {
    const debugContexts: Record<string, unknown>[] = [];

    const { store, projectDirectory } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      createGlobalDir: true,
      onDebug: (_message: string, context?: Record<string, unknown>) => {
        if (context) {
          debugContexts.push(context);
        }
      },
    });

    const configPath = path.resolve(projectDirectory, 'myapp.config.json');
    const temporaryPath = `${configPath}.tmp`;
    await writeFile(temporaryPath, '{ invalid', 'utf8');
    await rename(temporaryPath, configPath);

    const deadline = Date.now() + 5000;
    while (
      debugContexts.every((context) => context['code'] !== 'EPARSE') &&
      Date.now() < deadline
    ) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    expect(store!.config).toEqual({ port: 3000 });
    expect(debugContexts.some((context) => context['code'] === 'EPARSE')).toBe(
      true,
    );

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(
      store!,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    expect(store!.config).toEqual({ port: 8080 });

    await store!.stop();
  });

  it('multi-store all stopped → entry deleted from registry', async () => {
    const {
      store: store1,
      projectDirectory,
      globalDirectory,
    } = await setupTest({
      projectConfig: { port: 3000 },
      watch: true,
      createGlobalDir: true,
    });
    const store2 = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await store1!.stop();
    await store2.stop();

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 9999 });
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(store1!.config).toEqual({ port: 3000 });
    expect(store2.config).toEqual({ port: 3000 });
  });
});
