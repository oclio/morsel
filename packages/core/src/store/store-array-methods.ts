import { parsePath } from '@/paths/parse-path';
import {
  assertArray,
  popKey,
  pushKey,
  shiftKey,
  spliceKey,
  unshiftKey,
} from '@/store/array-ops';
import type { StoreState } from '@/store/store-state';
import type { StoreTarget } from '@/store/types';

type ConfigRecord = Record<string, unknown>;

/**
 * Array operation methods for the store.
 *
 * Each method delegates to the corresponding array-ops function,
 * passing the store state and mutability mode.
 */
export function createArrayMethods<T extends ConfigRecord>(
  state: StoreState<T>,
  mutability: 'frozen' | 'mutable',
) {
  return {
    async push(
      pathInput: string | readonly (string | number)[],
      value: unknown,
      target?: StoreTarget,
    ): Promise<number> {
      return pushKey(state, pathInput, value, target, mutability);
    },
    async unshift(
      pathInput: string | readonly (string | number)[],
      value: unknown,
      target?: StoreTarget,
    ): Promise<number> {
      return unshiftKey(state, pathInput, value, target, mutability);
    },
    async pop(
      pathInput: string | readonly (string | number)[],
      target?: StoreTarget,
    ): Promise<unknown> {
      return popKey(state, pathInput, target, mutability);
    },
    async shift(
      pathInput: string | readonly (string | number)[],
      target?: StoreTarget,
    ): Promise<unknown> {
      return shiftKey(state, pathInput, target, mutability);
    },
    async splice(
      pathInput: string | readonly (string | number)[],
      start: number,
      deleteCount: number,
      ...items: unknown[]
    ): Promise<unknown[]> {
      return spliceKey(
        state,
        pathInput,
        start,
        deleteCount,
        items,
        undefined,
        mutability,
      );
    },
    indexOf(
      pathInput: string | readonly (string | number)[],
      value: unknown,
    ): number {
      const array = assertArray(pathInput, state._config, parsePath(pathInput));
      return array.indexOf(value);
    },
    lastIndexOf(
      pathInput: string | readonly (string | number)[],
      value: unknown,
    ): number {
      const array = assertArray(pathInput, state._config, parsePath(pathInput));
      return array.lastIndexOf(value);
    },
  };
}
