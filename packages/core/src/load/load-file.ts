import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

import { MorselError } from '@/errors/error';
import { NoPluginError } from '@/errors/no-plugin-error';
import { selectParser } from '@/plugins/select-parser';
import type { FormatPlugin } from '@/plugins/types';

type ConfigRecord = Record<string, unknown>;

/**
 * Discriminated union indicating whether a config file was found on disk.
 */
export type LoadFileResult =
  | { readonly exists: true; readonly config: ConfigRecord }
  | { readonly exists: false; readonly config: Record<string, never> };

function isErrnoException(value: unknown): value is NodeJS.ErrnoException {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof (value as { code: unknown }).code === 'string'
  );
}

function toErrnoException(error: unknown): NodeJS.ErrnoException {
  if (isErrnoException(error)) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  return Object.assign(new Error(message), { code: 'UNKNOWN' });
}

function parseContent(
  content: string,
  filePath: string,
  formatPlugins: readonly FormatPlugin[],
): ConfigRecord {
  const plugin = selectParser(filePath, formatPlugins);
  if (plugin === undefined) {
    throw new NoPluginError(filePath, extensionOf(filePath));
  }

  try {
    return plugin.parse(content, filePath);
  } catch (error_) {
    const error = error_ as Error;
    const synthetic: NodeJS.ErrnoException = Object.assign(
      new Error(error.message),
      { code: 'EPARSE' },
    );
    throw new MorselError(filePath, 'EPARSE', synthetic);
  }
}

function extensionOf(filePath: string): string {
  const index = filePath.lastIndexOf('.');
  return index === -1 ? '' : filePath.slice(index);
}

/**
 * Read and parse a config file asynchronously.
 *
 * - `ENOENT`: returns `{ exists: false, config: {} }` — normal flow.
 * - Other fs errors: throws `MorselError` (code `EIO`).
 * - Parse errors: throws `MorselError` (code `EPARSE`).
 * - No matching plugin: throws `NoPluginError` (code `ENOPLUGIN`).
 *
 * @param filePath - Absolute path to the config file.
 * @param formatPlugins - Ordered list of format plugins.
 * @returns Discriminated union indicating whether the file exists.
 */
export async function loadFile(
  filePath: string,
  formatPlugins: readonly FormatPlugin[],
): Promise<LoadFileResult> {
  let content: string;

  try {
    content = await readFile(filePath, 'utf8');
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      return { exists: false, config: {} };
    }
    throw new MorselError(filePath, 'EIO', toErrnoException(error));
  }

  return {
    exists: true,
    config: parseContent(content, filePath, formatPlugins),
  };
}

/**
 * Synchronous version of {@link loadFile}.
 *
 * @param filePath - Absolute path to the config file.
 * @param formatPlugins - Ordered list of format plugins.
 * @returns Discriminated union indicating whether the file exists.
 */
export function loadFileSync(
  filePath: string,
  formatPlugins: readonly FormatPlugin[],
): LoadFileResult {
  let content: string;

  try {
    content = readFileSync(filePath, 'utf8');
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      return { exists: false, config: {} };
    }
    throw new MorselError(filePath, 'EIO', toErrnoException(error));
  }

  return {
    exists: true,
    config: parseContent(content, filePath, formatPlugins),
  };
}
