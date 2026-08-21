import path from 'node:path';

import {
  checkCycleOrDepth,
  mergeExtendsResults,
  type ProcessedExtends,
  processLoadedFile,
  type ResolveExtendsOptions,
  type ResolveExtendsResult,
} from '@/load/extends-core';
import { loadFileSync } from '@/load/load-file';

export type {
  ResolveExtendsOptions,
  ResolveExtendsResult,
} from '@/load/extends-core';

/**
 * Synchronously resolve a config file and its `extends` chain.
 *
 * Reads the file, applies `$env` overrides, and recursively resolves parent
 * configs declared via `extends`. Parent configs are deep-merged left-to-right
 * (first parent wins), then the own config is merged on top.
 *
 * @param filePath - Absolute or relative path to the config file.
 * @param options - `{ envName, onDebug, formatPlugins }`
 * @returns Discriminated union indicating whether the file exists, with the
 *   merged config and accumulated extends paths.
 */
export function resolveExtendsSync(
  filePath: string,
  options: ResolveExtendsOptions,
): ResolveExtendsResult {
  const visited = new Set<string>();
  return resolveExtendsSyncRecursive(filePath, options, visited, 0);
}

function resolveExtendsSyncRecursive(
  filePath: string,
  options: ResolveExtendsOptions,
  visited: Set<string>,
  depth: number,
): ResolveExtendsResult {
  const resolvedPath = path.resolve(filePath);

  checkCycleOrDepth(resolvedPath, visited, depth);

  const branchVisited = new Set(visited).add(resolvedPath);

  const fileResult = loadFileSync(resolvedPath, options.formatPlugins);
  const processed: ProcessedExtends = processLoadedFile(
    resolvedPath,
    fileResult,
    options,
  );

  if (!processed.needsRecursion) {
    return processed.result;
  }

  const parentResults: ResolveExtendsResult[] = Array.from(
    processed.parentPaths,
    (parentPath) =>
      resolveExtendsSyncRecursive(
        parentPath,
        options,
        branchVisited,
        depth + 1,
      ),
  );

  return mergeExtendsResults(
    processed.ownConfig,
    processed.parentPaths,
    parentResults,
  );
}
