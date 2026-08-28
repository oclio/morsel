import path from 'node:path';

import type { ResolvedOptions } from '@/store/boot/assert-name';
import type { ConfigRecord, Listener, MorselLayer } from '@/store/types';
import { deepClone } from '@/utils/deep-clone';

/**
 * Internal mutable state shared by the store, proxy, re-merge, and watcher modules.
 */
export interface StoreState<T extends ConfigRecord = ConfigRecord> {
  /**
  Internal: current merged config, swapped on live-reload.
  */
  _config: T;
  /**
  Internal: stable proxy created once, forwards gets to `_config`.
  */
  _proxy: T | undefined;
  /**
  Internal: frozen snapshot of config after `stop()`.
  */
  _stoppedConfig: T | undefined;
  /**
  Internal: resolved layers exposed via `store.layers`.
  */
  _layers: MorselLayer[];
  /**
  Internal: resolved options, used by the re-merge to avoid closure capture.
  */
  options: ResolvedOptions;
  listeners: Map<string, Set<Listener>>;
  wildcardListeners: Map<string, Set<Listener>>;
  stopped: boolean;
  watchers: Set<string>;
  watchedFiles: Map<string, Set<string>>;
  projectPath: string | undefined;
  lastConfig: ConfigRecord;
  remergeInProgress: boolean;
  remergeDone: Promise<void> | undefined;
  /**
  A fire arrived during a re-merge in progress — relaunch after current.
  */
  pendingRemerge: boolean;
  /**
  Debounce timers keyed by filename — debounce is per store, not per watcher.
  */
  debounceTimers: Map<string, NodeJS.Timeout>;
  /**
  Resolved watch debounce in ms for this store.
  */
  debounceMs: number;
  /**
  Re-merge function for this store — called by handle-event after debounce.
  */
  remerge: (store: StoreState) => Promise<void>;
  /**
  Layer sources that have already been logged as ENOENT during re-merge.
  Prevents spamming onDebug when a file stays missing across multiple fires.
  Reset when all previously-missing files reappear.
  */
  enoentLogged: Set<string>;
}

/**
 * Add a file path to the watched-files map, keyed by resolved directory.
 *
 * @param map - The watched-files map to mutate (directory → basenames).
 * @param filePath - The file path to add (resolved relative to cwd).
 */
export function addWatchedFile(
  map: Map<string, Set<string>>,
  filePath: string,
): void {
  const resolved = path.resolve(filePath);
  const directory = path.dirname(resolved);
  const basename = path.basename(resolved);
  let set = map.get(directory);
  if (set === undefined) {
    set = new Set();
    map.set(directory, set);
  }
  set.add(basename);
}

/**
 * Create a new StoreState with the given initial config and layers.
 *
 * @param config - The initial merged config.
 * @param layers - The initial resolved layers.
 * @param projectPath - The project config file path.
 * @param options - The resolved options, used by the re-merge.
 * @returns A new StoreState.
 */
export function createStoreState<T extends ConfigRecord>(
  config: T,
  layers: MorselLayer[],
  projectPath: string | undefined,
  options: ResolvedOptions,
  debounceMs: number,
  remerge: (store: StoreState) => Promise<void>,
): StoreState<T> {
  const watchedFiles = new Map<string, Set<string>>();
  if (projectPath !== undefined) {
    addWatchedFile(watchedFiles, projectPath);
  }
  for (const layer of layers) {
    if (layer.path !== undefined && layer.exists) {
      addWatchedFile(watchedFiles, layer.path);
    }
  }

  return {
    _config: config,
    _proxy: undefined,
    _stoppedConfig: undefined,
    _layers: layers,
    options,
    listeners: new Map(),
    wildcardListeners: new Map(),
    stopped: false,
    watchers: new Set(),
    watchedFiles,
    projectPath,
    lastConfig:
      options.configMutability === 'mutable'
        ? deepClone(config)
        : (config as ConfigRecord),
    remergeInProgress: false,
    remergeDone: undefined,
    pendingRemerge: false,
    debounceTimers: new Map(),
    debounceMs,
    remerge,
    enoentLogged: new Set(),
  };
}
