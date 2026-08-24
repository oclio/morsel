import { MorselError } from '@/errors/error';
import { runWriteHooks } from '@/hooks/run-hooks';
import type { WriteEvent } from '@/hooks/types';
import { applyMutability } from '@/load/merge-layers';
import { parsePath } from '@/paths/parse-path';
import {
  getPathValue,
  hasRemovedPathValue,
  setPathValue,
} from '@/paths/path-access';
import { emitChanges } from '@/store/emit-changes';
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

function assertArray(
  pathInput: string | readonly (string | number)[],
  config: Record<string, unknown>,
  segments: (string | number)[],
): unknown[] {
  const array = getPathValue(config, segments);
  if (!Array.isArray(array)) {
    throw new MorselError(
      undefined,
      'EVALIDATE',
      new Error(`"${pathInput}" is not an array`),
    );
  }
  return array;
}

function emitIndexListener(
  state: StoreState,
  segments: (string | number)[],
  index: number,
  next: unknown,
  prev: unknown,
): void {
  const indexKey = [...segments, index].join('.');
  const listeners = state.listeners.get(indexKey);
  if (listeners !== undefined) {
    for (const listener of listeners) {
      listener({ keyPath: indexKey, type: 'added', next, prev });
    }
  }
}

/**
 * Push a value onto the end of an array key. Returns the new element's index.
 */
export async function pushKey<T extends ConfigRecord>(
  state: StoreState<T>,
  pathInput: string | readonly (string | number)[],
  value: unknown,
  target: StoreTarget | undefined,
  mutability: 'frozen' | 'mutable',
): Promise<number> {
  const segments = parsePath(pathInput);
  const array = assertArray(pathInput, state._config, segments);
  const newIndex = array.length;
  await mutateKey(state, pathInput, [...array, value], target, mutability);
  emitIndexListener(state, segments, newIndex, value, undefined);
  return newIndex;
}

/**
 * Unshift a value onto the beginning of an array key. Returns 0.
 */
export async function unshiftKey<T extends ConfigRecord>(
  state: StoreState<T>,
  pathInput: string | readonly (string | number)[],
  value: unknown,
  target: StoreTarget | undefined,
  mutability: 'frozen' | 'mutable',
): Promise<number> {
  const segments = parsePath(pathInput);
  const array = assertArray(pathInput, state._config, segments);
  await mutateKey(state, pathInput, [value, ...array], target, mutability);
  return 0;
}

/**
 * Pop the last element from an array key. Returns the removed value.
 */
export async function popKey<T extends ConfigRecord>(
  state: StoreState<T>,
  pathInput: string | readonly (string | number)[],
  target: StoreTarget | undefined,
  mutability: 'frozen' | 'mutable',
): Promise<unknown> {
  const segments = parsePath(pathInput);
  const array = assertArray(pathInput, state._config, segments);
  const removed = array.at(-1);
  await mutateKey(state, pathInput, array.slice(0, -1), target, mutability);
  return removed;
}

/**
 * Shift the first element from an array key. Returns the removed value.
 */
export async function shiftKey<T extends ConfigRecord>(
  state: StoreState<T>,
  pathInput: string | readonly (string | number)[],
  target: StoreTarget | undefined,
  mutability: 'frozen' | 'mutable',
): Promise<unknown> {
  const segments = parsePath(pathInput);
  const array = assertArray(pathInput, state._config, segments);
  const removed = array[0];
  await mutateKey(state, pathInput, array.slice(1), target, mutability);
  return removed;
}

/**
 * Splice an array key: remove and/or insert elements. Returns the removed elements.
 */
export async function spliceKey<T extends ConfigRecord>(
  state: StoreState<T>,
  pathInput: string | readonly (string | number)[],
  start: number,
  deleteCount: number,
  items: unknown[],
  target: StoreTarget | undefined,
  mutability: 'frozen' | 'mutable',
): Promise<unknown[]> {
  const segments = parsePath(pathInput);
  const array = assertArray(pathInput, state._config, segments);
  const removed = array.slice(start, start + deleteCount);
  await mutateKey(
    state,
    pathInput,
    array.toSpliced(start, deleteCount, ...items),
    target,
    mutability,
  );
  return removed;
}
