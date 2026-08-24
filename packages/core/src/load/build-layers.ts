import { createHookContext } from '@/hooks/hook-context';
import { runHooks } from '@/hooks/run-hooks';
import type { HookContext } from '@/hooks/types';
import type { ResolvedLayer } from '@/load/resolve-layer';
import { resolveLayer } from '@/load/resolve-layer';
import type { ResolvedOptions } from '@/store/assert-name';
import { noop } from '@/store/assert-name';

interface LayerResolveOptions {
  readonly envName: string | undefined;
  readonly onDebug: ResolvedOptions['onDebug'];
  readonly formatPlugins: ResolvedOptions['formatPlugins'];
}

/**
 * Resolve all four layers (defaults, global, project, overrides) with their
 * surrounding lifecycle hooks. Shared by the initial boot load and the
 * re-merge pipeline to avoid duplicating the 8-point hook sequence.
 *
 * @param resolved - Fully resolved options.
 * @param globalPath - Resolved global config file path (or undefined).
 * @param projectPath - Resolved project config file path (or undefined).
 * @returns The ordered array of resolved layers interleaved with hook layers.
 */
export async function buildLayers(
  resolved: ResolvedOptions,
  globalPath: string | undefined,
  projectPath: string | undefined,
  triggerRemerge: () => void = noop,
): Promise<ResolvedLayer[]> {
  const context: HookContext = createHookContext(resolved, triggerRemerge);
  const layerOptions: LayerResolveOptions = {
    envName: resolved.envName,
    onDebug: resolved.onDebug,
    formatPlugins: resolved.formatPlugins,
  };
  const { hooks } = resolved;

  return [
    ...(await runHooks(hooks, 'before:defaults', context)),
    await resolveLayer('defaults', undefined, resolved.defaults, layerOptions),
    ...(await runHooks(hooks, 'after:defaults', context)),
    ...(await runHooks(hooks, 'before:global', context)),
    await resolveLayer('global', globalPath, undefined, layerOptions),
    ...(await runHooks(hooks, 'after:global', context)),
    ...(await runHooks(hooks, 'before:project', context)),
    await resolveLayer('project', projectPath, undefined, layerOptions),
    ...(await runHooks(hooks, 'after:project', context)),
    ...(await runHooks(hooks, 'before:overrides', context)),
    await resolveLayer(
      'overrides',
      undefined,
      resolved.overrides,
      layerOptions,
    ),
    ...(await runHooks(hooks, 'after:overrides', context)),
  ];
}
