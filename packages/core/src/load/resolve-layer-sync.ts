import { stripExtends } from '@/load/extends-helpers';
import { buildFileLayer, buildRawLayer } from '@/load/layer-helpers';
import type { DebugCallback } from '@/load/resolve-env';
import { resolveEnv } from '@/load/resolve-env';
import { resolveExtendsSync } from '@/load/resolve-extends-sync';
import type { LayerSource, ResolvedLayer } from '@/load/resolve-layer';
import type { MorselFormatPlugin } from '@/plugins/types';

type ConfigRecord = Record<string, unknown>;

interface ResolveLayerSyncOptions {
  readonly envName: string | undefined;
  readonly onDebug: DebugCallback | undefined;
  readonly formatPlugins: readonly MorselFormatPlugin[];
}

/**
 * Synchronous version of {@link resolveLayer}.
 *
 * - `defaults`/`overrides`: raw objects, $env resolved, extends stripped.
 * - `global`/`project`: load file → resolve extends → resolve $env → cleanup.
 *
 * @param source - The layer source identifier.
 * @param filePath - Absolute path to the file, or undefined for defaults/overrides.
 * @param rawConfig - Raw config object for defaults/overrides.
 * @param options - `{ envName, onDebug }`
 * @returns A resolved layer with config, exists flag, and extends paths.
 */
export function resolveLayerSync(
  source: LayerSource,
  filePath: string | undefined,
  rawConfig: ConfigRecord | undefined,
  options: ResolveLayerSyncOptions,
): ResolvedLayer {
  if (filePath === undefined) {
    if (source === 'global' || source === 'project') {
      return {
        source,
        path: undefined,
        exists: false,
        config: {},
        extendsPaths: [],
      };
    }

    const envResolved = resolveEnv(rawConfig ?? {}, options);
    const stripped = stripExtends(envResolved);
    return buildRawLayer(source, stripped);
  }

  const result = resolveExtendsSync(filePath, options);

  return buildFileLayer(source, filePath, result);
}
