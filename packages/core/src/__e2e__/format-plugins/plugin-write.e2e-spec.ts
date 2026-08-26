import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createTemporaryEnvironment,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

describe('plugin-write — serialize during mutations', () => {
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

  it('serialize called during set mutation', async () => {
    let serializeCalls = 0;
    const customPlugin = {
      name: 'custom-json',
      extensions: ['.json'],
      parse: (content: string) =>
        JSON.parse(content) as Record<string, unknown>,
      serialize: (data: Record<string, unknown>) => {
        serializeCalls++;
        return `${JSON.stringify(data, undefined, 2)}\n`;
      },
    };

    await writeFile(
      path.resolve(projectDirectory, 'myapp.config.json'),
      '{"port": 3000}',
      'utf8',
    );

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      formatPlugins: [customPlugin],
    });

    await store.set('host', 'localhost');

    expect(serializeCalls).toBeGreaterThanOrEqual(1);

    await store.stop();
  });

  it('serialize called during unset mutation', async () => {
    let serializeCalls = 0;
    const customPlugin = {
      name: 'custom-json',
      extensions: ['.json'],
      parse: (content: string) =>
        JSON.parse(content) as Record<string, unknown>,
      serialize: (data: Record<string, unknown>) => {
        serializeCalls++;
        return `${JSON.stringify(data, undefined, 2)}\n`;
      },
    };

    await writeFile(
      path.resolve(projectDirectory, 'myapp.config.json'),
      '{"port": 3000, "host": "localhost"}',
      'utf8',
    );

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      formatPlugins: [customPlugin],
    });

    await store.unset('host');

    expect(serializeCalls).toBeGreaterThanOrEqual(1);

    await store.stop();
  });

  it('serialize failure → WriteError(EWRITE)', async () => {
    const throwingPlugin = {
      name: 'throwing-serialize',
      extensions: ['.json'],
      parse: (content: string) =>
        JSON.parse(content) as Record<string, unknown>,
      serialize: () => {
        throw new Error('serialize failed');
      },
    };

    await writeFile(
      path.resolve(projectDirectory, 'myapp.config.json'),
      '{"port": 3000}',
      'utf8',
    );

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      formatPlugins: [throwingPlugin],
    });

    await expect(store.set('host', 'localhost')).rejects.toMatchObject({
      name: 'WriteError',
      code: 'EWRITE',
    });

    await store.stop();
  });

  it('serialize with custom plugin produces correct format', async () => {
    await writeFile(
      path.resolve(projectDirectory, 'myapp.config.morsel'),
      'port=3000',
      'utf8',
    );

    const store = await watchConfig({
      name: 'myapp',
      cwd: projectDirectory,
      globalDir: globalDirectory,
      formatPlugins: [
        {
          name: 'morsel',
          extensions: ['.morsel'],
          parse: (content: string) => {
            const result: Record<string, unknown> = {};
            for (const line of content.split('\n')) {
              const [key, value] = line.split('=', 2);
              if (key && value !== undefined) {
                result[key.trim()] = Number(value.trim());
              }
            }
            return result;
          },
          serialize: (data: Record<string, unknown>) =>
            Object.entries(data)
              .map(([key, value]) => `${key}=${value}`)
              .join('\n') + '\n',
        },
      ],
    });

    await store.set('host', 'localhost');

    const content = await readFile(
      path.resolve(projectDirectory, 'myapp.config.morsel'),
      'utf8',
    );

    expect(content).toContain('port=3000');
    expect(content).toContain('host=localhost');

    await store.stop();
  });
});
