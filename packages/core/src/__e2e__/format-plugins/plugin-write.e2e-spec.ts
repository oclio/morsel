import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  clearWatcherRegistry,
  createThrowingPlugin,
  setupTest,
  suppressConsoleError,
} from '@oclio/morsel-e2e-helpers';

describe('plugin-write — serialize during mutations', () => {
  suppressConsoleError();

  beforeEach(() => {
    clearWatcherRegistry();
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

    const { store } = await setupTest({
      rawFiles: [{ filename: 'myapp.config.json', content: '{"port": 3000}' }],
      createGlobalDir: true,
      watch: true,
      formatPlugins: [customPlugin],
    });

    await store!.set('host', 'localhost');

    expect(serializeCalls).toBeGreaterThanOrEqual(1);

    await store!.stop();
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

    const { store } = await setupTest({
      rawFiles: [
        {
          filename: 'myapp.config.json',
          content: '{"port": 3000, "host": "localhost"}',
        },
      ],
      createGlobalDir: true,
      watch: true,
      formatPlugins: [customPlugin],
    });

    await store!.unset('host');

    expect(serializeCalls).toBeGreaterThanOrEqual(1);

    await store!.stop();
  });

  it('serialize failure → WriteError(EWRITE)', async () => {
    const throwingPlugin = createThrowingPlugin({ name: 'throwing-serialize' });

    const { store } = await setupTest({
      rawFiles: [{ filename: 'myapp.config.json', content: '{"port": 3000}' }],
      createGlobalDir: true,
      watch: true,
      formatPlugins: [throwingPlugin],
    });

    await expect(store!.set('host', 'localhost')).rejects.toMatchObject({
      name: 'WriteError',
      code: 'EWRITE',
    });

    await store!.stop();
  });

  it('serialize with custom plugin produces correct format', async () => {
    const { store, projectDirectory } = await setupTest({
      rawFiles: [{ filename: 'myapp.config.morsel', content: 'port=3000' }],
      createGlobalDir: true,
      watch: true,
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
    } as never);

    await store!.set('host', 'localhost');

    const content = await readFile(
      path.resolve(projectDirectory, 'myapp.config.morsel'),
      'utf8',
    );

    expect(content).toContain('port=3000');
    expect(content).toContain('host=localhost');

    await store!.stop();
  });
});
