import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createDebugCollector,
  setupTest,
  waitForDebugContext,
  waitForRemerge,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

describe('watch-lifecycle-rollback — rollback & recovery', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('rollback on parse error: corrupt file keeps config, onDebug EPARSE', async () => {
    const { contexts, callback } = createDebugCollector();

    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      onDebug: callback,
    });

    expect(store!.config).toEqual({ port: 3000 });

    const configPath = path.resolve(projectDirectory, 'myapp.config.json');
    await writeFile(configPath, '{ invalid json !!!', 'utf8');

    await waitForDebugContext(
      contexts,
      (context) => context['code'] === 'EPARSE',
    );

    expect(store!.config).toEqual({ port: 3000 });
    expect(contexts.some((context) => context['code'] === 'EPARSE')).toBe(true);

    await store!.stop();
  });

  it('rollback on validation error: keeps config, onDebug EVALIDATE', async () => {
    const { contexts: debugContexts, callback } = createDebugCollector();

    const validate = (config: Record<string, unknown>) => {
      if (config['port'] !== undefined && typeof config['port'] !== 'number') {
        throw new Error('port must be a number');
      }
      return config;
    };

    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      validationPlugins: [{ name: 'port-type', validate }],
      onDebug: callback,
    });

    expect(store!.config).toEqual({ port: 3000 });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      port: 'not-a-number',
    });

    await waitForDebugContext(
      debugContexts,
      (context) => context['code'] === 'EVALIDATE',
    );

    expect(store!.config).toEqual({ port: 3000 });
    expect(
      debugContexts.some((context) => context['code'] === 'EVALIDATE'),
    ).toBe(true);

    await store!.stop();
  });

  it('recover after error: corrupt then fix → re-merge succeeds', async () => {
    const { contexts, callback } = createDebugCollector();

    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      onDebug: callback,
    });

    expect(store!.config).toEqual({ port: 3000 });

    const configPath = path.resolve(projectDirectory, 'myapp.config.json');
    await writeFile(configPath, '{ invalid json !!!', 'utf8');

    const deadline = Date.now() + 10_000;
    while (
      contexts.every((context) => context['code'] !== 'EPARSE') &&
      Date.now() < deadline
    ) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    expect(store!.config).toEqual({ port: 3000 });
    expect(contexts.some((context) => context['code'] === 'EPARSE')).toBe(true);

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(
      store!,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    expect(store!.config).toEqual({ port: 8080 });

    await store!.stop();
  });

  it('config always up to date: store.config reflects latest value', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    expect(store!.config).toEqual({ port: 3000 });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(
      store!,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    expect(store!.config).toEqual({ port: 8080 });

    await store!.stop();
  });

  it('layers updated: store.layers reflects re-merge', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
    });

    const projectLayer = store!.layers.find((l) => l.source === 'project');
    expect(projectLayer?.exists).toBe(true);
    expect(projectLayer?.config).toEqual({ port: 3000 });

    await writeConfig(projectDirectory, 'myapp.config.json', { port: 8080 });
    await waitForRemerge(
      store!,
      (config) => (config as Record<string, unknown>)['port'] === 8080,
    );

    const updatedProjectLayer = store!.layers.find(
      (l) => l.source === 'project',
    );
    expect(updatedProjectLayer?.config).toEqual({ port: 8080 });

    await store!.stop();
  });
});
