import { runWriteHooks } from '@/hooks/run-hooks';
import type { WriteEvent } from '@/hooks/types';
import { applyMutability } from '@/load/merge-layers';
import { parsePath } from '@/paths/parse-path';
import { hasRemovedPathValue, setPathValue } from '@/paths/path-access';
import { emitChanges } from '@/store/reactive/emit-changes';
import type { StoreState } from '@/store/store-state';
import { deepCloneConfig } from '@/store/store-state';
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
 * Optimistically mutate a key in the store: clone, set, apply mutability,
 * emit changes, then persist to disk. Rollback on write failure.
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

  const previousSnapshot = deepCloneConfig(state._config);
  const clonedNext = deepCloneConfig(state._config);
  setPathValue(clonedNext, segments, value);

  state._config = applyMutability(clonedNext as T, mutability);
  emitChanges(
    previousSnapshot,
    clonedNext,
    state.listeners,
    state.wildcardListeners,
  );

  const mutation = { path: dottedPath, value };
  const mutatedConfig = state._config;
  try {
    await writeConfigFile(
      targetFilePath,
      mutation,
      state.options.formatPlugins,
    );
  } catch (error) {
    if (state._config === mutatedConfig) {
      state._config = applyMutability(previousSnapshot as T, mutability);
      emitChanges(
        clonedNext,
        previousSnapshot,
        state.listeners,
        state.wildcardListeners,
      );
    }
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

  const previousSnapshot = deepCloneConfig(state._config);
  const clonedNext = deepCloneConfig(state._config);
  const isRemoved = hasRemovedPathValue(clonedNext, segments);

  if (!isRemoved) {
    return false;
  }

  state._config = applyMutability(clonedNext as T, mutability);
  emitChanges(
    previousSnapshot,
    clonedNext,
    state.listeners,
    state.wildcardListeners,
  );

  const deleteMutation = { isDelete: true, path: dottedPath } as const;
  const mutatedConfig = state._config;
  try {
    for (const file of targetFiles) {
      await writeConfigFile(file, deleteMutation, state.options.formatPlugins);
    }
  } catch (error) {
    if (state._config === mutatedConfig) {
      state._config = applyMutability(previousSnapshot as T, mutability);
      emitChanges(
        clonedNext,
        previousSnapshot,
        state.listeners,
        state.wildcardListeners,
      );
    }
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
