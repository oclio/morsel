import path from 'node:path';

import { MorselError } from '@/errors/morsel-error';
import { normalizeExtends, stripExtends } from '@/load/extends-helpers';
import type { LoadFileResult } from '@/load/load-file';
import type { DebugCallback } from '@/load/resolve-env';
import { resolveEnv } from '@/load/resolve-env';
import { deepMerge } from '@/merge/deep-merge';
import type { FormatPlugin } from '@/plugins/types';

const MAX_DEPTH = 10;

type ConfigRecord = Record<string, unknown>;

/**
 * Result of resolving a file and its extends chain.
 */
export interface ResolveExtendsResult {
  readonly exists: boolean;
  readonly config: Record<string, unknown>;
  readonly extendsPaths: string[];
}

/**
 * Options passed to extends resolution functions.
 */
export interface ResolveExtendsOptions {
  readonly envName: string | undefined;
  readonly onDebug: DebugCallback | undefined;
  readonly formatPlugins: readonly FormatPlugin[];
}

/**
 * Check for extends cycle or depth limit. Throws `MorselError` (code `ECYCLE`)
 * when a cycle is detected or the depth limit is reached.
 *
 * In one-shot/boot mode the error propagates to the consumer.
 * In watch re-merge mode the error is caught by the remerge catch block
 * which logs and keeps the last valid config.
 */
export function checkCycleOrDepth(
  resolvedPath: string,
  visited: Set<string>,
  depth: number,
): void {
  if (!(visited.has(resolvedPath) || depth >= MAX_DEPTH)) {
    return;
  }

  const message = `extends cycle or depth limit (${MAX_DEPTH}) reached at ${resolvedPath}`;
  throw new MorselError(resolvedPath, 'ECYCLE', new Error(message));
}

/**
 * Discriminated union returned by `processLoadedFile`.
 * Either a final result (no recursion needed) or parent paths to recurse into.
 */
export type ProcessedExtends =
  | { readonly needsRecursion: false; readonly result: ResolveExtendsResult }
  | {
      readonly needsRecursion: true;
      readonly parentPaths: string[];
      readonly ownConfig: ConfigRecord;
    };

/**
 * Process a loaded file result. Returns either a final `ResolveExtendsResult`
 * (when the file doesn't exist or has no `extends`) or the info needed to
 * recurse into parent files.
 */
export function processLoadedFile(
  resolvedPath: string,
  fileResult: LoadFileResult,
  options: ResolveExtendsOptions,
): ProcessedExtends {
  if (!fileResult.exists) {
    return {
      needsRecursion: false,
      result: { exists: false, config: {}, extendsPaths: [] },
    };
  }

  const rawConfig = fileResult.config;
  const envResolved = resolveEnv(rawConfig, options);
  const extendsValue = envResolved['extends'];
  const ownConfig = stripExtends(envResolved);

  if (extendsValue === undefined) {
    return {
      needsRecursion: false,
      result: { exists: true, config: ownConfig, extendsPaths: [] },
    };
  }

  const parentPaths = normalizeExtends(
    extendsValue,
    path.dirname(resolvedPath),
  );

  return { needsRecursion: true, parentPaths, ownConfig };
}

/**
 * Merge parent results with the file's own config. Parents are deep-merged
 * left-to-right (first parent wins for shared keys), then the own config
 * is merged on top.
 */
export function mergeExtendsResults(
  ownConfig: ConfigRecord,
  parentPaths: readonly string[],
  parentResults: readonly ResolveExtendsResult[],
): ResolveExtendsResult {
  let mergedConfig: ConfigRecord = {};
  const extendsPaths: string[] = [];

  for (const [index, parentResult] of parentResults.entries()) {
    const parentPath = parentPaths[index] as string;
    mergedConfig = deepMerge(mergedConfig, parentResult.config, 'replace');
    extendsPaths.push(...parentResult.extendsPaths, path.resolve(parentPath));
  }

  const finalConfig = deepMerge(mergedConfig, ownConfig, 'replace');

  return {
    exists: true,
    config: finalConfig,
    extendsPaths: [...new Set(extendsPaths)],
  };
}
