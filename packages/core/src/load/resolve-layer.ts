import { stripExtends } from '@/load/extends-helpers';
import { buildFileLayer, buildRawLayer } from '@/load/layer-helpers';
import type { DebugCallback } from '@/load/resolve-env';
import { resolveEnv } from '@/load/resolve-env';
import { resolveExtends } from '@/load/resolve-extends';
import type { FormatPlugin } from '@/plugins/types';

type ConfigRecord = Record<string, unknown>;

/**
 * Identifier for the origin of a config layer.
 */
export type LayerSource =
  'defaults' | 'global' | 'project' | 'overrides' | 'hook';

/**
 * A fully resolved config layer with its merged config and metadata.
 */
export interface ResolvedLayer {
  readonly source: LayerSource;
  readonly path: string | undefined;
  readonly exists: boolean;
  readonly config: ConfigRecord;
  readonly extendsPaths: string[];
  readonly hookName?: string;
}

interface ResolveLayerOptions {
  readonly envName: string | undefined;
  readonly onDebug: DebugCallback | undefined;
  readonly formatPlugins: readonly FormatPlugin[];
}

/**
 * Resolve a single layer asynchronously.
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
export async function resolveLayer(
  source: LayerSource,
  filePath: string | undefined,
  rawConfig: ConfigRecord | undefined,
  options: ResolveLayerOptions,
): Promise<ResolvedLayer> {
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

  const result = await resolveExtends(filePath, options);

  return buildFileLayer(source, filePath, result);
}
