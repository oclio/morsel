import type { LayerSource, ResolvedLayer } from '@/load/resolve-layer';

type ConfigRecord = Record<string, unknown>;

interface ExtendsResult {
  readonly exists: boolean;
  readonly config: ConfigRecord;
  readonly extendsPaths: string[];
}

/**
 * Build a `ResolvedLayer` from a raw config (defaults or overrides).
 */
export function buildRawLayer(
  source: LayerSource,
  rawConfig: ConfigRecord,
): ResolvedLayer {
  return {
    source,
    path: undefined,
    exists: true,
    config: rawConfig,
    extendsPaths: [],
  };
}

/**
 * Build a `ResolvedLayer` from a hook's output config.
 */
export function buildHookLayer(
  hookName: string,
  rawConfig: ConfigRecord,
): ResolvedLayer {
  return {
    source: 'hook',
    path: undefined,
    exists: true,
    config: rawConfig,
    extendsPaths: [],
    hookName,
  };
}

/**
 * Build a `ResolvedLayer` from a file-based extends result.
 * Returns an empty layer when the file does not exist.
 */
export function buildFileLayer(
  source: LayerSource,
  filePath: string,
  result: ExtendsResult,
): ResolvedLayer {
  if (!result.exists) {
    return {
      source,
      path: filePath,
      exists: false,
      config: {},
      extendsPaths: [],
    };
  }

  return {
    source,
    path: filePath,
    exists: true,
    config: result.config,
    extendsPaths: result.extendsPaths,
  };
}
