import type { ResolvedLayer } from '@/load/resolve-layer';
import type { MorselLayer } from '@/store/types';
import { deepFreeze } from '@/utils/deep-freeze';

/**
 * Convert a {@link ResolvedLayer} into an immutable {@link MorselLayer}.
 * Deep-freezes the config and extendsPaths array.
 */
export function toMorselLayer(layer: ResolvedLayer): MorselLayer {
  const base = {
    source: layer.source,
    path: layer.path,
    config: deepFreeze({ ...layer.config }),
    exists: layer.exists,
    extendsPaths: Object.freeze([...layer.extendsPaths]),
  };

  return layer.hookName === undefined
    ? base
    : { ...base, hookName: layer.hookName };
}
