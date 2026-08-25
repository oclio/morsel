import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('mutations-concurrent — serialization', () => {
  let directory: string;
  let projectDirectory: string;
  let globalDirectory: string;

  beforeEach(async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    clearWatcherRegistry();
    const env = await createTemporaryEnvironment();
    directory = env.directory;
    projectDirectory = `${directory}/project`;
    globalDirectory = `${directory}/global`;
    await mkdir(projectDirectory, { recursive: true });
    await mkdir(globalDirectory, { recursive: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('concurrent mutations to same file: serialized per file path', async () => {
    await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
    });

    await Promise.all([
      store.set('a', 1),
      store.set('b', 2),
      store.set('c', 3),
    ]);

    expect(store.config).toEqual({ port: 3000, a: 1, b: 2, c: 3 });

    const content = JSON.parse(
      await readFile(
        path.resolve(projectDirectory, 'myapp.config.json'),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(content).toEqual({ port: 3000, a: 1, b: 2, c: 3 });

    await store.stop();
  });
});
