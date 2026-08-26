import { doDeleteKey } from '@/store/store-mutation-delete';
import { doMutateKey } from '@/store/store-mutation-set';
import type { StoreState } from '@/store/store-state';
import type { DeleteTarget, StoreTarget } from '@/store/types';
import { chainMutation } from '@/store/write-queue';

type ConfigRecord = Record<string, unknown>;

/**
 * Optimistically set a key by path, re-merge the cascade, apply validation
 * and mutability, emit change events, then persist to source file. Rollback
 * on write failure. Serialized via the store's write queue.
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

  if (!state.queueEnabled) {
    return doMutateKey(state, pathInput, value, target, mutability);
  }

  return chainMutation(state, () =>
    doMutateKey(state, pathInput, value, target, mutability),
  );
}

/**
 * Optimistically delete a key from the store: clone, remove, apply mutability,
 * emit changes, then persist deletion to disk. Rollback on write failure.
 * Serialized via the store's write queue.
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

  if (!state.queueEnabled) {
    return doDeleteKey(state, pathInput, target, mutability);
  }

  return chainMutation(state, () =>
    doDeleteKey(state, pathInput, target, mutability),
  );
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
