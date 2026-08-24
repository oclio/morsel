import { MorselError } from '@/errors/error';
import { parsePath } from '@/paths/parse-path';
import { getPathValue } from '@/paths/path-access';
import { mutateKey } from '@/store/store-mutator';
import type { StoreState } from '@/store/store-state';
import type { StoreTarget } from '@/store/types';

type ConfigRecord = Record<string, unknown>;

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
