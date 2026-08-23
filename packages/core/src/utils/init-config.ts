import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { MorselError } from '@/errors/morsel-error';
import { resolvePaths, resolveProjectPathSync } from '@/paths/resolve-paths';
import { resolveOptions } from '@/store/assert-name';
import type { ConfigRecord, MorselOptions } from '@/store/types';

/**
 * Bootstrap a project config file if it doesn't exist.
 *
 * 1. Check if `./<name>.config<ext>` exists (multi-extension via formatPlugins).
 * 2. If yes: return the path, don't write.
 * 3. If no: `mkdirSync(dirname, { recursive: true })`, write `content` (or `fallbackContent`).
 * 4. Return the written path.
 * 5. On failure (permissions, disk full): throw `MorselError` (code `EIO`).
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

  const projectPath = resolvePaths(resolved, resolved.formatPlugins).project;

  const content = options.content ?? options.fallbackContent ?? {};
  let json: string;
  try {
    json = `${JSON.stringify(content, undefined, 2)}\n`;
  } catch {
    json = '{}\n';
  }

  try {
    mkdirSync(path.dirname(projectPath), { recursive: true });
    const temporaryPath = `${projectPath}.tmp`;
    writeFileSync(temporaryPath, json, 'utf8');
    renameSync(temporaryPath, projectPath);
    return projectPath;
  } catch (error) {
    const cause = error as NodeJS.ErrnoException;
    throw new MorselError(projectPath, 'EIO', cause);
  }
}
