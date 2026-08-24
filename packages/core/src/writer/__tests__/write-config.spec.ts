import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import path from 'node:path';

import { MorselError } from '@/errors/morsel-error';
import { jsonPlugin } from '@/plugins/json-plugin';
import type { FormatPlugin } from '@/plugins/types';
import { writeConfigFile } from '@/writer/write-config';

describe('writeConfigFile', () => {
  let temporaryDirectory: string;

  beforeEach(async () => {
    temporaryDirectory = await fs.mkdtemp(
      path.join(os.tmpdir(), 'morsel-writer-test-'),
    );
  });

  afterEach(async () => {
    await fs.rm(temporaryDirectory, { force: true, recursive: true });
  });

  describe('set operation', () => {
    it.each<{
      name: string;
      initial: Record<string, unknown> | undefined;
      keyPath: string;
      value: unknown;
      expected: Record<string, unknown>;
    }>([
      {
        name: 'creates and writes new key in file',
        initial: undefined,
        keyPath: 'server.port',
        value: 8080,
        expected: { server: { port: 8080 } },
      },
      {
        name: 'updates existing key preserving other keys',
        initial: { database: { name: 'prod' }, server: { port: 3000 } },
        keyPath: 'server.port',
        value: 9000,
        expected: { database: { name: 'prod' }, server: { port: 9000 } },
      },
    ])('$name', async ({ initial, keyPath, value, expected }) => {
      const filePath = path.join(temporaryDirectory, 'app.config.json');
      if (initial !== undefined) {
        await fs.writeFile(filePath, JSON.stringify(initial), 'utf8');
      }

      await writeConfigFile(filePath, { path: keyPath, value }, [jsonPlugin]);

      const content = JSON.parse(await fs.readFile(filePath, 'utf8'));
      expect(content).toEqual(expected);
    });
  });

  describe('delete operation', () => {
    it('deletes existing key from file', async () => {
      const filePath = path.join(temporaryDirectory, 'app.config.json');
      await fs.writeFile(
        filePath,
        JSON.stringify({ database: { name: 'prod' }, server: { port: 3000 } }),
        'utf8',
      );

      await writeConfigFile(filePath, { isDelete: true, path: 'server.port' }, [
        jsonPlugin,
      ]);

      const content = JSON.parse(await fs.readFile(filePath, 'utf8'));
      expect(content).toEqual({ database: { name: 'prod' }, server: {} });
    });

    it('delete removes key from object rather than setting to undefined', async () => {
      const preservingPlugin: FormatPlugin = {
        name: 'preserving-json',
        extensions: ['.json'],
        parse: jsonPlugin.parse,
        serialize(data: Record<string, unknown>): string {
          const replacer = (_key: string, value: unknown): unknown =>
            value === undefined ? '__UNDEFINED__' : value;
          return JSON.stringify(data, replacer, 2) + '\n';
        },
      };
      const filePath = path.join(temporaryDirectory, 'app.config.json');
      await fs.writeFile(
        filePath,
        JSON.stringify({ server: { port: 3000 } }),
        'utf8',
      );

      await writeConfigFile(filePath, { isDelete: true, path: 'server.port' }, [
        preservingPlugin,
      ]);

      const content = await fs.readFile(filePath, 'utf8');
      expect(content).not.toContain('__UNDEFINED__');
    });
  });

  describe('plugin resolution', () => {
    it('uses default jsonPlugin when no plugins argument is provided', async () => {
      const filePath = path.join(temporaryDirectory, 'app.config.json');

      await writeConfigFile(filePath, { path: 'a', value: 1 });

      const content = JSON.parse(await fs.readFile(filePath, 'utf8'));
      expect(content).toEqual({ a: 1 });
    });

    it('passes string content to plugin parse, not Buffer', async () => {
      const strictPlugin: FormatPlugin = {
        name: 'strict-json',
        extensions: ['.json'],
        parse(content: string, _filePath: string) {
          if (typeof content !== 'string') {
            throw new TypeError('content must be a string');
          }
          return JSON.parse(content);
        },
        serialize(data: Record<string, unknown>): string {
          return JSON.stringify(data, undefined, 2) + '\n';
        },
      };
      const filePath = path.join(temporaryDirectory, 'app.config.json');
      await fs.writeFile(filePath, JSON.stringify({ a: 1 }), 'utf8');

      await writeConfigFile(filePath, { path: 'a', value: 2 }, [strictPlugin]);

      const content = JSON.parse(await fs.readFile(filePath, 'utf8'));
      expect(content).toEqual({ a: 2 });
    });
  });

  describe('error handling', () => {
    it('throws MorselError with EWRITE code and cause when no plugin matches file extension', async () => {
      const filePath = path.join(temporaryDirectory, 'app.config.yaml');

      await expect(
        writeConfigFile(filePath, { path: 'a', value: 1 }, [jsonPlugin]),
      ).rejects.toMatchObject({
        code: 'EWRITE',
        cause: expect.objectContaining({
          message: expect.stringContaining('No format plugin found'),
        }),
      });
    });

    it('throws MorselError when file read fails with non-ENOENT error', async () => {
      const filePath = path.join(temporaryDirectory, 'app.config.json');
      await fs.writeFile(filePath, JSON.stringify({ a: 1 }), 'utf8');
      await fs.chmod(filePath, 0o000);

      await expect(
        writeConfigFile(filePath, { path: 'a', value: 2 }, [jsonPlugin]),
      ).rejects.toThrow(MorselError);

      await fs.chmod(filePath, 0o666);
    });

    it('wraps non-Error throws from plugin parse into MorselError', async () => {
      const throwingPlugin: FormatPlugin = {
        name: 'throwing',
        extensions: ['.json'],
        parse: () => {
          throw 'not an Error';
        },
        serialize: () => '',
      };
      const filePath = path.join(temporaryDirectory, 'app.config.json');
      await fs.writeFile(filePath, JSON.stringify({ a: 1 }), 'utf8');

      await expect(
        writeConfigFile(filePath, { path: 'a', value: 2 }, [throwingPlugin]),
      ).rejects.toThrow(MorselError);
    });
  });

  describe('concurrency', () => {
    it('handles concurrent writes to the same file path', async () => {
      const filePath = path.join(temporaryDirectory, 'app.config.json');

      await Promise.all([
        writeConfigFile(filePath, { path: 'a', value: 1 }, [jsonPlugin]),
        writeConfigFile(filePath, { path: 'b', value: 2 }, [jsonPlugin]),
      ]);

      const content = JSON.parse(await fs.readFile(filePath, 'utf8'));
      expect(content).toEqual({ a: 1, b: 2 });
    });

    it('cleans up write queue entry only for the last concurrent write', async () => {
      const filePath = path.join(temporaryDirectory, 'app.config.json');
      const deleteSpy = vi.spyOn(Map.prototype, 'delete');

      await Promise.all([
        writeConfigFile(filePath, { path: 'a', value: 1 }, [jsonPlugin]),
        writeConfigFile(filePath, { path: 'b', value: 2 }, [jsonPlugin]),
      ]);

      const queueDeletes = deleteSpy.mock.calls.filter(
        (call) => call[0] === filePath,
      );
      expect(queueDeletes).toHaveLength(1);

      deleteSpy.mockRestore();
    });
  });

  describe('atomic write', () => {
    it('writes temp file with utf8 encoding', async () => {
      const filePath = path.join(temporaryDirectory, 'app.config.json');
      const spy = vi.spyOn(fs, 'writeFile');

      await writeConfigFile(filePath, { path: 'a', value: 1 }, [jsonPlugin]);

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('.tmp.'),
        expect.any(String),
        'utf8',
      );
      spy.mockRestore();
    });
  });
});
