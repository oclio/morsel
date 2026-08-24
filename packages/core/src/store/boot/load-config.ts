import { createHookContext } from '@/hooks/hook-context';
import { runHooks, runHooksSync } from '@/hooks/run-hooks';
import { applyValidation } from '@/load/apply-validation';
import { applyMutability, mergeLayers } from '@/load/merge-layers';
import type { ResolvedLayer } from '@/load/resolve-layer';
import { resolveLayer } from '@/load/resolve-layer';
import { resolveLayerSync } from '@/load/resolve-layer-sync';
import { interpolate } from '@/merge/interpolate';
import {
  resolveGlobalPath,
  resolveGlobalPathSync,
  resolveProjectPath,
  resolveProjectPathSync,
} from '@/paths/resolve-paths';
import { noop, resolveOptions } from '@/store/boot/assert-name';
import { toMorselLayer } from '@/store/layer';
import type { ConfigRecord, ConfigResult, MorselOptions } from '@/store/types';

/**
 * Load and merge config synchronously.
 *
 * Reads defaults → global → project → overrides, deep-merges them,
 * and returns the result. Throws `MorselError` on fs or parse errors.
 *
 * @param options - Configuration options.
 * @returns `{ config, layers }` — the merged config and layer trace.
 */
export function loadConfigSync<T extends ConfigRecord = ConfigRecord>(
  options: MorselOptions<T>,
): ConfigResult<T> {
  const resolved = resolveOptions(options);
  const globalPath = resolveGlobalPathSync(resolved, resolved.formatPlugins);
  const projectPath = resolveProjectPathSync(resolved, resolved.formatPlugins);

  const layerOptions = {
    envName: resolved.envName,
    onDebug: resolved.onDebug,
    formatPlugins: resolved.formatPlugins,
  };

  const context = createHookContext(resolved, noop);
  const { hooks, onDebug } = resolved;

  const layers: ResolvedLayer[] = [
    ...runHooksSync(hooks, 'before:defaults', context, onDebug),
    resolveLayerSync('defaults', undefined, resolved.defaults, layerOptions),
    ...runHooksSync(hooks, 'after:defaults', context, onDebug),
    ...runHooksSync(hooks, 'before:global', context, onDebug),
    resolveLayerSync('global', globalPath, undefined, layerOptions),
    ...runHooksSync(hooks, 'after:global', context, onDebug),
    ...runHooksSync(hooks, 'before:project', context, onDebug),
    resolveLayerSync('project', projectPath, undefined, layerOptions),
    ...runHooksSync(hooks, 'after:project', context, onDebug),
    ...runHooksSync(hooks, 'before:overrides', context, onDebug),
    resolveLayerSync('overrides', undefined, resolved.overrides, layerOptions),
    ...runHooksSync(hooks, 'after:overrides', context, onDebug),
  ];

  const merged = mergeLayers(layers, resolved.arrayMerge);
  const interpolated = interpolate(merged);
  const validated = applyValidation(interpolated, resolved.validationPlugins);
  const config = applyMutability(validated, resolved.configMutability) as T;

  return {
    config,
    layers: layers.map((layer) => toMorselLayer(layer)),
  };
}

/**
 * Load and merge config asynchronously.
 *
 * Same as {@link loadConfigSync} but using async fs operations.
 *
 * @param options - Configuration options.
 * @returns `{ config, layers }` — the merged config and layer trace.
 */
export async function loadConfig<T extends ConfigRecord = ConfigRecord>(
  options: MorselOptions<T>,
): Promise<ConfigResult<T>> {
  const resolved = resolveOptions(options);
  const globalPath = await resolveGlobalPath(resolved, resolved.formatPlugins);
  const projectPath = await resolveProjectPath(
    resolved,
    resolved.formatPlugins,
  );

  const layerOptions = {
    envName: resolved.envName,
    onDebug: resolved.onDebug,
    formatPlugins: resolved.formatPlugins,
  };

  const context = createHookContext(resolved, noop);
  const { hooks, onDebug } = resolved;

  const layers: ResolvedLayer[] = [
    ...(await runHooks(hooks, 'before:defaults', context, onDebug)),
    await resolveLayer('defaults', undefined, resolved.defaults, layerOptions),
    ...(await runHooks(hooks, 'after:defaults', context, onDebug)),
    ...(await runHooks(hooks, 'before:global', context, onDebug)),
    await resolveLayer('global', globalPath, undefined, layerOptions),
    ...(await runHooks(hooks, 'after:global', context, onDebug)),
    ...(await runHooks(hooks, 'before:project', context, onDebug)),
    await resolveLayer('project', projectPath, undefined, layerOptions),
    ...(await runHooks(hooks, 'after:project', context, onDebug)),
    ...(await runHooks(hooks, 'before:overrides', context, onDebug)),
    await resolveLayer(
      'overrides',
      undefined,
      resolved.overrides,
      layerOptions,
    ),
    ...(await runHooks(hooks, 'after:overrides', context, onDebug)),
  ];

  const merged = mergeLayers(layers, resolved.arrayMerge);
  const interpolated = interpolate(merged);
  const validated = applyValidation(interpolated, resolved.validationPlugins);
  const config = applyMutability(validated, resolved.configMutability) as T;

  return {
    config,
    layers: layers.map((layer) => toMorselLayer(layer)),
  };
}
