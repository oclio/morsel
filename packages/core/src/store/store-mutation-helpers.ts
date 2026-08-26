import type { StoreState } from '@/store/store-state';
import type { StoreTarget } from '@/store/types';
import { resolveKeyOrigin } from '@/writer/resolve-origin';

/**
 * Resolve the target file path for a mutation. Uses the key's origin layer
 * if writable, otherwise falls back to the project path. Throws if no
 * writable file is available.
 */
export function getWritableTargetFile(
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
