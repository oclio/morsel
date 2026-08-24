import { promises as fs } from 'node:fs';
import path from 'node:path';

import { WriteError } from '@/errors/write-error';
import { hasRemovedPathValue, setPathValue } from '@/paths/path-access';
import { jsonPlugin } from '@/plugins/json-plugin';
import { selectParser } from '@/plugins/select-parser';
import type { FormatPlugin } from '@/plugins/types';

/**
 * Describes a mutation to apply to a configuration file.
 */
export interface MutationOperation {
  readonly path: string;
  readonly value?: unknown;
  readonly isDelete?: boolean;
}

const writeQueues = new Map<string, Promise<unknown>>();

async function enqueueWrite<T>(
  filePath: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = writeQueues.get(filePath) ?? Promise.resolve();
  const next = (async () => {
    try {
      await previous;
    } catch {
      // Ignore previous errors in queue
    }
    return operation();
  })();

  writeQueues.set(filePath, next);

  try {
    return await next;
  } finally {
    if (writeQueues.get(filePath) === next) {
      writeQueues.delete(filePath);
    }
  }
}

async function readOrCreateLayerContent(
  filePath: string,
  plugin: FormatPlugin,
): Promise<Record<string, unknown>> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return plugin.parse(raw, filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

/**
 * Perform an atomic read-modify-write on a configuration file.
 * Serialized per file path through an in-memory promise queue.
 *
 * @param filePath - Full target file path.
 * @param mutation - Mutation operation (set or delete).
 * @param plugins - Registered format plugins.
 */
export async function writeConfigFile(
  filePath: string,
  mutation: MutationOperation,
  plugins: readonly FormatPlugin[] = [jsonPlugin],
): Promise<void> {
  await enqueueWrite(filePath, async () => {
    try {
      const plugin = selectParser(filePath, plugins);
      if (plugin === undefined) {
        throw new Error(`No format plugin found for file "${filePath}"`);
      }

      const data = await readOrCreateLayerContent(filePath, plugin);

      if (mutation.isDelete) {
        hasRemovedPathValue(data, mutation.path);
      } else {
        setPathValue(data, mutation.path, mutation.value);
      }

      const serialized = plugin.serialize(data);

      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const temporaryPath = `${filePath}.tmp.${Date.now()}`;
      await fs.writeFile(temporaryPath, serialized, 'utf8');
      await fs.rename(temporaryPath, filePath);
    } catch (error) {
      throw new WriteError(
        filePath,
        mutation,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  });
}
