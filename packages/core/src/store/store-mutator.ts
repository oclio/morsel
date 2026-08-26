import { runWriteHooks } from '@/hooks/run-hooks';
import type { WriteEvent } from '@/hooks/types';
import { parsePath } from '@/paths/parse-path';
import { hasRemovedPathValue, setPathValue } from '@/paths/path-access';
import {
  applyOptimisticUpdate,
  rollbackOptimisticUpdate,
} from '@/store/store-optimistic-update';
import type { StoreState } from '@/store/store-state';
import type { DeleteTarget, StoreTarget } from '@/store/types';
import { resolveKeyOrigin } from '@/writer/resolve-origin';
import { writeConfigFile } from '@/writer/write-config';

type ConfigRecord = Record<string, unknown>;

function getWritableTargetFile(
  pathKey: string,
  state: StoreState,
  target?: StoreTarget,
): string {
  const origin = resolveKeyOrigin(pathKey, state._layers, target);
  if (origin.isWritable && origin.filePath !== undefined) {
    return origin.filePath;
  }

  if (state.projectPath !== undefined) {
    return state.projectPath;
  }

  throw new Error(`morsel: cannot write "${pathKey}" — no writable file found`);
}

/**
 * Optimistically set a key by path, re-merge the cascade, apply validation
 * and mutability, emit change events, then persist to source file. Rollback
 * on write failure.
 */
export async function mutateKey<T extends ConfigRecord>(
  state: StoreState<T>,
  pathInput: string | readonly (string | number)[],
  value: unknown,
  target: StoreTarget | undefined,
  mutability: 'frozen' | 'mutable',
): Promise<void> {
  if (state.stopped) {
    throw new Error('morsel: store is stopped');
  }

  const segments = parsePath(pathInput);
  const dottedPath = segments.join('.');
  const targetFilePath = getWritableTargetFile(dottedPath, state, target);

  const previousLayers = state._layers;
  const previousConfig = state._config;
  const previousLastConfig = state.lastConfig;

  const didChange = applyOptimisticUpdate(
    state,
    mutability,
    [targetFilePath],
    (layerConfig) => {
      setPathValue(layerConfig, segments, value);
      return true; // setPathValue always mutates
    },
  );

  if (!didChange) {
    return;
  }

  const mutatedConfig = state._config;
  const mutation = { path: dottedPath, value };
  try {
    await writeConfigFile(
      targetFilePath,
      mutation,
      state.options.formatPlugins,
    );
  } catch (error) {
    rollbackOptimisticUpdate(
      state,
      previousLayers,
      previousConfig,
      previousLastConfig,
      mutatedConfig,
    );
    throw error;
  }

  const writeEvent: WriteEvent = {
    filePath: targetFilePath,
    keyPath: dottedPath,
    mutation,
  };
  await runWriteHooks(state.options.hooks, writeEvent, state.options.onDebug);
}

/**
 * Optimistically delete a key from the store: clone, remove, apply mutability,
 * emit changes, then persist deletion to disk. Rollback on write failure.
 */
export async function deleteKey<T extends ConfigRecord>(
  state: StoreState<T>,
  pathInput: string | readonly (string | number)[],
  target: DeleteTarget | undefined,
  mutability: 'frozen' | 'mutable',
): Promise<boolean> {
  if (state.stopped) {
    throw new Error('morsel: store is stopped');
  }

  const segments = parsePath(pathInput);
  const dottedPath = segments.join('.');

  const targetFiles: string[] = [];
  if (target === 'global' || target === 'project') {
    targetFiles.push(getWritableTargetFile(dottedPath, state, target));
  } else {
    for (const layer of state._layers) {
      if (
        (layer.source === 'project' || layer.source === 'global') &&
        layer.path !== undefined
      ) {
        targetFiles.push(layer.path);
      }
    }
  }

  const previousLayers = state._layers;
  const previousConfig = state._config;
  const previousLastConfig = state.lastConfig;

  const didChange = applyOptimisticUpdate(
    state,
    mutability,
    targetFiles,
    (layerConfig) => {
      return hasRemovedPathValue(layerConfig, segments);
    },
  );

  if (!didChange) {
    return false;
  }

  const mutatedConfig = state._config;
  const deleteMutation = { isDelete: true, path: dottedPath } as const;
  try {
    for (const file of targetFiles) {
      await writeConfigFile(file, deleteMutation, state.options.formatPlugins);
    }
  } catch (error) {
    rollbackOptimisticUpdate(
      state,
      previousLayers,
      previousConfig,
      previousLastConfig,
      mutatedConfig,
    );
    throw error;
  }

  for (const file of targetFiles) {
    const writeEvent: WriteEvent = {
      filePath: file,
      keyPath: dottedPath,
      mutation: deleteMutation,
    };
    await runWriteHooks(state.options.hooks, writeEvent, state.options.onDebug);
  }

  return true;
}

/**
 * Alias for {@link mutateKey} — set a key by path and persist to source file.
 */
export async function setKey<T extends ConfigRecord>(
  state: StoreState<T>,
  pathInput: string | readonly (string | number)[],
  value: unknown,
  target: StoreTarget | undefined,
  mutability: 'frozen' | 'mutable',
): Promise<void> {
  return mutateKey(state, pathInput, value, target, mutability);
}

/**
 * Alias for {@link deleteKey} — delete a key by path and persist deletion.
 */
export async function unsetKey<T extends ConfigRecord>(
  state: StoreState<T>,
  pathInput: string | readonly (string | number)[],
  target: DeleteTarget | undefined,
  mutability: 'frozen' | 'mutable',
): Promise<boolean> {
  return deleteKey(state, pathInput, target, mutability);
}
