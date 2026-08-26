import { getPathValue } from '@/paths/path-access';
import type {
  MorselLayer,
  Provenance,
  ProvenanceOverride,
} from '@/store/types';

/**
 * Trace the provenance of a configuration key — the final value, its
 * source layer, and the chain of overridden layers.
 *
 * Traverses `layers` in reverse cascade order (highest priority
 * first). The first layer where the key exists determines the
 * winner. Subsequent layers where the key exists populate
 * `overridden`. Returns `undefined` if no layer defines the key.
 *
 * @param layers - The resolved layers in cascade order.
 * @param path - Dot/bracket path string or segment array.
 * @returns The provenance, or `undefined` if the key is absent.
 */
export function resolveProvenance(
  layers: readonly MorselLayer[],
  path: string | readonly (string | number)[],
): Provenance | undefined {
  let winner: Provenance | undefined;
  const overridden: ProvenanceOverride[] = [];

  for (let index = layers.length - 1; index >= 0; index--) {
    const layer = layers[index] as MorselLayer;
    const layerValue = getPathValue(layer.config, path);
    if (layerValue === undefined) {
      continue;
    }

    const entry: ProvenanceOverride = {
      value: layerValue,
      source: layer.source,
      file: layer.path,
      ...(layer.hookName !== undefined && { hookName: layer.hookName }),
    };

    if (winner === undefined) {
      winner = {
        ...entry,
        overridden,
      };
    } else {
      overridden.push(entry);
    }
  }

  return winner;
}
