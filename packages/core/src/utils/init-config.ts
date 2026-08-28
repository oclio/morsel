import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { MorselError } from '@/errors/error';
import { resolveProjectPathSync } from '@/paths/resolve-paths';
import { resolveOptions } from '@/store/boot/assert-name';
import type { ConfigRecord, MorselOptions } from '@/store/types';

/**
 * Bootstrap a project config file if it doesn't exist.
 *
 * 1. Check if `./<name>.config<ext>` or `./.config/<name>.<ext>` exists.
 * 2. If yes: return the path, don't write.
 * 3. If no: write `content` (or `fallbackContent`) — prefers `.config/` dir
 *    if it already exists, otherwise writes at the project root.
 * 4. Return the written path.
 * 5. On serialize failure: throws `MorselError` (code `EIO`).
 * 6. On write failure (permissions, disk full): throws `MorselError` (code `EIO`).
 *
 * @param options - `{ name, cwd?, content?, fallbackContent? }`.
 * @returns The existing or written path.
 * @throws MorselError When the write fails.
 */
export function initConfig<T extends ConfigRecord = ConfigRecord>(
  options: Pick<MorselOptions<T>, 'name' | 'cwd' | 'formatPlugins'> & {
    readonly content?: T;
    readonly fallbackContent?: T;
  },
): string {
  const resolved = resolveOptions(options);
  const existingPath = resolveProjectPathSync(resolved, resolved.formatPlugins);

  if (existingPath !== undefined) {
    return existingPath;
  }

  const cwd = resolved.cwd || process.cwd();
  const plugin = resolved.formatPlugins[0];
  if (plugin === undefined) {
    throw new TypeError('morsel: formatPlugins must not be empty');
  }
  const extension = plugin.extensions[0] ?? '.json';
  const configDirectory = path.resolve(cwd, '.config');
  const useConfigDirectory = existsSync(configDirectory);
  const projectPath = useConfigDirectory
    ? path.resolve(configDirectory, `${resolved.name}${extension}`)
    : path.resolve(cwd, `${resolved.name}.config${extension}`);

  const content = options.content ?? options.fallbackContent ?? {};
  let serialized: string;
  try {
    serialized = plugin.serialize(content);
  } catch (error) {
    throw new MorselError(
      projectPath,
      'EIO',
      error instanceof Error ? error : new Error(String(error)),
    );
  }

  try {
    mkdirSync(path.dirname(projectPath), { recursive: true });
    const temporaryPath = `${projectPath}.tmp.${Date.now()}`;
    writeFileSync(temporaryPath, serialized, 'utf8');
    renameSync(temporaryPath, projectPath);
    return projectPath;
  } catch (error) {
    const cause = error as NodeJS.ErrnoException;
    throw new MorselError(projectPath, 'EIO', cause);
  }
}
