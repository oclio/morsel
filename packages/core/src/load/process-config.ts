import { applyValidation } from '@/load/apply-validation';
import type { ConfigMutability } from '@/load/merge-layers';
import { applyMutability, mergeLayers } from '@/load/merge-layers';
import type { ResolvedLayer } from '@/load/resolve-layer';
import type { ArrayMergeStrategy } from '@/merge/deep-merge';
import { interpolateInPlace } from '@/merge/interpolate';
import type { ValidationPlugin } from '@/plugins/types';
import { deepClone } from '@/utils/deep-clone';

type ConfigRecord = Record<string, unknown>;

/**
 * Result of processing config layers through the full pipeline.
 */
export interface ProcessedConfig<T extends ConfigRecord> {
  /**
  The final config after mutability is applied.
  */
  config: T;
  /**
  The validated config before mutability — used as the emit source.
  */
  validated: ConfigRecord;
  /**
  The lastConfig snapshot: deep-cloned if mutable, same ref if frozen.
  */
  lastConfig: ConfigRecord;
}

/**
 * Run the full config pipeline: merge → interpolate → validate → mutability.
 *
 * This is the single source of truth for the 5-step transformation shared
 * across boot and re-merge paths.
 *
 * @param layers - Resolved layers to merge.
 * @param arrayMerge - Array merge strategy.
 * @param validationPlugins - Validation plugins to apply.
 * @param mutability - Config mutability mode.
 * @returns The processed config with intermediate values for emit.
 */
export function processConfig<T extends ConfigRecord = ConfigRecord>(
  layers: ResolvedLayer[],
  arrayMerge: ArrayMergeStrategy,
  validationPlugins: readonly ValidationPlugin[],
  mutability: ConfigMutability,
): ProcessedConfig<T> {
  const merged = mergeLayers(layers, arrayMerge);
  const interpolated = interpolateInPlace(merged);
  const validated = applyValidation(interpolated, validationPlugins);
  const config = applyMutability(validated, mutability) as T;
  const lastConfig =
    mutability === 'mutable' ? deepClone(validated) : validated;

  return { config, validated, lastConfig };
}
