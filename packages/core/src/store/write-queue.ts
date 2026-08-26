import type { StoreState } from '@/store/store-state';

/**
 * Chain a mutation onto the store's write queue. The mutation waits for
 * all previously queued mutations to settle (success or failure) before
 * executing. The queue is updated to swallow errors so that a failed
 * mutation does not block subsequent ones — the caller receives the
 * real result via the returned promise.
 */
export async function chainMutation<T>(
  state: StoreState,
  function_: () => Promise<T>,
): Promise<T> {
  const run = enqueue(state, function_);
  state.writeQueue = drainQueue(run);
  return run;
}

async function enqueue<T>(
  state: StoreState,
  function_: () => Promise<T>,
): Promise<T> {
  try {
    await state.writeQueue;
  } catch {
    // Previous mutation failed — queue continues for this one
  }
  return function_();
}

async function drainQueue(promise: Promise<unknown>): Promise<void> {
  try {
    await promise;
  } catch {
    // Swallowed: the error is propagated to the caller via the returned promise
  }
}
