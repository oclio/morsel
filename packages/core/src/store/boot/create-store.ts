import { resolveOptions } from '@/store/boot/assert-name';
import { loadPipeline } from '@/store/boot/load-config';
import { createStaticMorselStore } from '@/store/store';
import { createStoreState } from '@/store/store-state';
import type { ConfigRecord, MorselStore, StoreOptions } from '@/store/types';

/**
 * Create a static configuration store.
 *
 * Loads and merges all layers (defaults → global → project → overrides + hooks),
 * then returns a {@link MorselStore} with `get`, `has`, `all`, `dotify`,
 * `getProvenance`, `indexOf`, `lastIndexOf`, and `stop`.
 *
 * No watchers, no events, no re-merge, no proxy. The config is frozen after boot.
 * Use `createReactiveStore` for live-reload and event-driven access.
 *
 * @param options - Configuration options.
 * @returns A static store.
 */
export async function createStore<T extends ConfigRecord = ConfigRecord>(
  options: StoreOptions<T>,
): Promise<MorselStore<T>> {
  const resolved = resolveOptions(options);

  const { config, morselLayers, projectPath } = await loadPipeline<T>(resolved);

  const state = createStoreState<T>(
    config,
    morselLayers,
    projectPath,
    resolved,
    0,
    () => Promise.resolve(),
  );

  return createStaticMorselStore(state, resolved.configMutability);
}
