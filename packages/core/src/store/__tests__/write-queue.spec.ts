import { createMockStoreState } from '@oclio/test-helpers';

import type { StoreState } from '@/store/store-state';
import { chainMutation } from '@/store/write-queue';

function createState(overrides: Partial<StoreState> = {}): StoreState {
  return createMockStoreState({
    projectPath: undefined,
    ...overrides,
  }) as StoreState;
}

describe('write-queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs a single mutation and returns its result', async () => {
    const state = createState();

    const result = await chainMutation(state, async () => 42);

    expect(result).toBe(42);
  });

  it('serializes concurrent mutations in call order', async () => {
    const order: number[] = [];
    const state = createState();

    const makeFunction = (id: number, delay: number) => async () => {
      order.push(id);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return id;
    };

    await Promise.all([
      chainMutation(state, makeFunction(1, 20)),
      chainMutation(state, makeFunction(2, 5)),
      chainMutation(state, makeFunction(3, 1)),
    ]);

    expect(order).toEqual([1, 2, 3]);
  });

  it('isolates errors: failed mutation does not block subsequent ones', async () => {
    const state = createState();

    const failing = async (): Promise<void> => {
      throw new Error('boom');
    };
    const succeeding = async () => 'ok';

    const results = await Promise.allSettled([
      chainMutation(state, failing),
      chainMutation(state, succeeding),
    ]);

    expect(results[0].status).toBe('rejected');
    expect(results[1].status).toBe('fulfilled');
  });

  it('updates writeQueue after each mutation', async () => {
    const state = createState();
    const initial = state.writeQueue;

    await chainMutation(state, async () => undefined);

    expect(state.writeQueue).not.toBe(initial);
  });

  it('propagates the error to the caller', async () => {
    const state = createState();

    await expect(
      chainMutation(state, async () => {
        throw new Error('propagated');
      }),
    ).rejects.toThrow('propagated');
  });

  it('allows the queue to continue after a rejected previous queue', async () => {
    const state = createState();
    state.writeQueue = Promise.reject(new Error('prior'));

    const result = await chainMutation(state, async () => 'recovered');

    expect(result).toBe('recovered');
  });

  it('writeQueue awaits the mutation before resolving', async () => {
    const state = createState();
    let isMutationCompleted = false;

    void chainMutation(state, async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      isMutationCompleted = true;
    });

    await state.writeQueue;

    expect(isMutationCompleted).toBe(true);
  });
});
