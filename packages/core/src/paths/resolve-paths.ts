import { existsSync } from 'node:fs';
import { access } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

import type { FormatPlugin } from '@/plugins/types';

function throwEmptyPlugins(): never {
  throw new TypeError('morsel: formatPlugins must not be empty');
}

/**
 * Resolved global and project config file paths.
 */
export interface ResolvedPaths {
  readonly global: string;
  readonly project: string;
}

/**
 * Options for path resolution functions.
 */
export interface ResolvePathsOptions {
  readonly name: string;
  readonly cwd?: string;
  readonly globalDir?: string;
}

/**
 * Resolve the global config directory.
 *
 * Priority: explicit `globalDir` option → `~/.config/<name>`.
 * On Windows, falls back to `%APPDATA%/<name>` if `APPDATA` is set.
 */
export function resolveGlobalDirectory(options: ResolvePathsOptions): string {
  if (options.globalDir !== undefined && options.globalDir !== '') {
    const directory = options.globalDir;
    if (directory.startsWith('~/')) {
      return path.resolve(homedir(), directory.slice(2));
    }
    if (directory === '~') {
      return homedir();
    }
    return path.resolve(directory);
  }

  const appData = process.env['APPDATA'];
  if (appData !== undefined && appData !== '' && process.platform === 'win32') {
    return path.resolve(appData, options.name);
  }

  return path.resolve(homedir(), '.config', options.name);
}

/**
 * Collect candidate extensions from format plugins, in order, deduplicated.
 */
function collectExtensions(formatPlugins: readonly FormatPlugin[]): string[] {
  const seen = new Set<string>();
  const all = formatPlugins.flatMap((plugin) => plugin.extensions);
  const extensions: string[] = [];
  for (const extension of all) {
    if (seen.has(extension)) {
      continue;
    }

    seen.add(extension);
    extensions.push(extension);
  }
  return extensions;
}

/**
 * Build candidate project paths.
 *
 * Checks `<cwd>/<name>.config<ext>` first, then `<cwd>/.config/<name><ext>`
 * for each extension (`.config/` directory convention adopted by Vite, ESLint,
 * c12, cosmiconfig).
 */
function candidateProjectPaths(
  options: ResolvePathsOptions,
  formatPlugins: readonly FormatPlugin[],
): string[] {
  const cwd = options.cwd || process.cwd();
  const extensions = collectExtensions(formatPlugins);
  const rootCandidates = extensions.map((extension) =>
    path.resolve(cwd, `${options.name}.config${extension}`),
  );
  const configDirectoryCandidates = extensions.map((extension) =>
    path.resolve(cwd, '.config', `${options.name}${extension}`),
  );
  return [...rootCandidates, ...configDirectoryCandidates];
}

/**
 * Build candidate global paths: `<globalDir>/<name>.config<ext>` for each extension.
 */
function candidateGlobalPaths(
  options: ResolvePathsOptions,
  formatPlugins: readonly FormatPlugin[],
): string[] {
  const directory = resolveGlobalDirectory(options);
  const extensions = collectExtensions(formatPlugins);
  return extensions.map((extension) =>
    path.resolve(directory, `${options.name}.config${extension}`),
  );
}

/**
 * Discover the project config file path asynchronously.
 *
 * Checks each `./<name>.config<ext>` candidate in formatPlugins order.
 * First file that exists wins. Returns `undefined` if none found.
 *
 * @param options - `{ name, cwd?, globalDir? }`
 * @param formatPlugins - Ordered list of format plugins.
 */
export async function resolveProjectPath(
  options: ResolvePathsOptions,
  formatPlugins: readonly FormatPlugin[],
): Promise<string | undefined> {
  if (formatPlugins.length === 0) {
    throwEmptyPlugins();
  }

  for (const candidate of candidateProjectPaths(options, formatPlugins)) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // try next candidate
    }
  }
  return undefined;
}

/**
 * Synchronous version of {@link resolveProjectPath}.
 *
 * @param options - `{ name, cwd?, globalDir? }`
 * @param formatPlugins - Ordered list of format plugins.
 */
export function resolveProjectPathSync(
  options: ResolvePathsOptions,
  formatPlugins: readonly FormatPlugin[],
): string | undefined {
  if (formatPlugins.length === 0) {
    throwEmptyPlugins();
  }

  for (const candidate of candidateProjectPaths(options, formatPlugins)) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

/**
 * Discover the global config file path asynchronously.
 *
 * @param options - `{ name, cwd?, globalDir? }`
 * @param formatPlugins - Ordered list of format plugins.
 */
export async function resolveGlobalPath(
  options: ResolvePathsOptions,
  formatPlugins: readonly FormatPlugin[],
): Promise<string | undefined> {
  if (formatPlugins.length === 0) {
    throwEmptyPlugins();
  }

  for (const candidate of candidateGlobalPaths(options, formatPlugins)) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // try next candidate
    }
  }
  return undefined;
}

/**
 * Synchronous version of {@link resolveGlobalPath}.
 *
 * @param options - `{ name, cwd?, globalDir? }`
 * @param formatPlugins - Ordered list of format plugins.
 */
export function resolveGlobalPathSync(
  options: ResolvePathsOptions,
  formatPlugins: readonly FormatPlugin[],
): string | undefined {
  if (formatPlugins.length === 0) {
    throwEmptyPlugins();
  }

  for (const candidate of candidateGlobalPaths(options, formatPlugins)) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

/**
 * Resolve all config file paths without reading any files.
 * Returns the first candidate for each (based on formatPlugins order).
 * Useful for `myapp config path` commands.
 *
 * @param options - `{ name, cwd?, globalDir? }`
 * @param formatPlugins - Ordered list of format plugins.
 * @returns Resolved paths for global and project config files.
 */
export function resolvePaths(
  options: ResolvePathsOptions,
  formatPlugins: readonly FormatPlugin[],
): ResolvedPaths {
  if (formatPlugins.length === 0) {
    throwEmptyPlugins();
  }

  const extensions = collectExtensions(formatPlugins);
  const extension = extensions[0];
  const cwd = options.cwd || process.cwd();
  return {
    global: path.resolve(
      resolveGlobalDirectory(options),
      `${options.name}.config${extension}`,
    ),
    project: path.resolve(cwd, `${options.name}.config${extension}`),
  };
}
