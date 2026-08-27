import path from 'node:path';

import type { LayerWatchableHook } from '@/hooks/types';
import type { ResolvedLayer } from '@/load/resolve-layer';
import type { StoreState } from '@/store/store-state';
import { addWatchedFile } from '@/store/store-state';
import { createWatcher, releaseWatcher } from '@/watch/watcher-registry';

function isWatchableHook(hook: {
  readonly name: string;
}): hook is LayerWatchableHook {
  return 'watchPaths' in hook;
}

/**
 * Collect candidate config filenames (`<name>.config<ext>`) for a directory,
 * one per format plugin extension. Allows detecting future file creation
 * even when no config file exists yet at boot.
 */
function addCandidateFiles(
  map: Map<string, Set<string>>,
  directory: string,
  name: string,
  formatPlugins: readonly { readonly extensions: readonly string[] }[],
): void {
  const extensions = new Set<string>();
  for (const plugin of formatPlugins) {
    for (const extension of plugin.extensions) {
      extensions.add(extension);
    }
  }
  for (const extension of extensions) {
    addWatchedFile(map, path.resolve(directory, `${name}.config${extension}`));
  }
}

/**
 * Populate `state.watchedFiles` from layer paths, extendsPaths, hook watchPaths,
 * and candidate filenames for cwd and globalDir.
 */
export function collectWatchedFiles(
  state: StoreState,
  layers: ResolvedLayer[],
): void {
  for (const layer of layers) {
    if (layer.path !== undefined && layer.exists) {
      addWatchedFile(state.watchedFiles, layer.path);
    }
    for (const extendsPath of layer.extendsPaths) {
      addWatchedFile(state.watchedFiles, extendsPath);
    }
  }

  for (const hook of state.options.hooks) {
    if (isWatchableHook(hook)) {
      for (const watchPath of hook.watchPaths) {
        addWatchedFile(state.watchedFiles, watchPath);
      }
    }
  }

  addCandidateFiles(
    state.watchedFiles,
    state.options.cwd,
    state.options.name,
    state.options.formatPlugins,
  );
  addCandidateFiles(
    state.watchedFiles,
    state.options.globalDir,
    state.options.name,
    state.options.formatPlugins,
  );
}

/**
 * Clear and rebuild `state.watchedFiles` after a re-merge: re-adds projectPath
 * then calls {@link collectWatchedFiles} with the new layers.
 */
export function updateWatchedFiles(
  state: StoreState,
  layers: ResolvedLayer[],
): void {
  state.watchedFiles.clear();
  if (state.projectPath !== undefined) {
    addWatchedFile(state.watchedFiles, state.projectPath);
  }
  collectWatchedFiles(state, layers);
}

function collectDirectories(
  state: StoreState,
  layers: ResolvedLayer[],
): Set<string> {
  const directories = new Set<string>([
    path.resolve(state.options.cwd),
    path.resolve(state.options.globalDir),
  ]);

  for (const layer of layers) {
    if (layer.path !== undefined) {
      directories.add(path.dirname(layer.path));
    }
    for (const extendsPath of layer.extendsPaths) {
      directories.add(path.dirname(extendsPath));
    }
  }

  for (const hook of state.options.hooks) {
    if (isWatchableHook(hook)) {
      for (const watchPath of hook.watchPaths) {
        directories.add(path.dirname(path.resolve(watchPath)));
      }
    }
  }

  return directories;
}

/**
 * Create `fs.watch` watchers for every unique directory derived from layers,
 * extendsPaths, hook watchPaths, cwd, and globalDir. Called once at boot.
 */
export function setupWatchers(
  state: StoreState,
  layers: ResolvedLayer[],
): void {
  const directories = collectDirectories(state, layers);

  for (const directory of directories) {
    createWatcher(directory, state);
    state.watchers.add(directory);
  }
}

/**
 * Reconcile watchers after a re-merge: create watchers for new directories
 * and release watchers for directories no longer present in layers.
 */
export function updateWatchers(
  state: StoreState,
  layers: ResolvedLayer[],
): void {
  const newDirectories = collectDirectories(state, layers);

  for (const directory of newDirectories) {
    if (state.watchers.has(directory)) {
      continue;
    }

    createWatcher(directory, state);
    state.watchers.add(directory);
  }

  const directoriesToRemove: string[] = [];
  for (const directory of state.watchers) {
    if (!newDirectories.has(directory)) {
      directoriesToRemove.push(directory);
    }
  }

  for (const directory of directoriesToRemove) {
    releaseWatcher(directory, state);
    state.watchers.delete(directory);
  }
}
