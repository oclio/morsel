import { MorselError } from '@/errors/error';
import { runHooks, runHooksSync, runWriteHooks } from '@/hooks/run-hooks';
import type {
  EventHook,
  HookContext,
  HookLifecycle,
  LayerHook,
  WriteEvent,
} from '@/hooks/types';

const context: HookContext = {
  cwd: '/fake',
  envName: 'test',
  triggerRemerge: () => {},
};

function makeHook(
  name: string,
  lifecycle: HookLifecycle,
  load: LayerHook['load'],
): LayerHook {
  return { name, lifecycle, load };
}

describe('runHooksSync', () => {
  it.each([
    [
      'non-matching hooks',
      [makeHook('env', 'after:defaults', () => ({ key: 'value' }))],
    ],
    ['empty hooks', []],
  ])('returns empty array when %s', (_label, hooks) => {
    const layers = runHooksSync(hooks, 'before:defaults', context);

    expect(layers).toEqual([]);
  });

  it('produces a hook layer for each matching hook', () => {
    const hooks = [
      makeHook('env', 'before:defaults', () => ({ env: 'test' })),
      makeHook('pkg', 'before:defaults', () => ({ version: '1.0.0' })),
    ];

    const layers = runHooksSync(hooks, 'before:defaults', context);

    expect(layers).toHaveLength(2);
    expect(layers[0]).toMatchObject({
      source: 'hook',
      hookName: 'env',
      config: { env: 'test' },
      exists: true,
      path: undefined,
    });
    expect(layers[1]).toMatchObject({
      source: 'hook',
      hookName: 'pkg',
      config: { version: '1.0.0' },
    });
  });

  it('only runs hooks matching the exact lifecycle point', () => {
    const hooks = [
      makeHook('env', 'before:defaults', () => ({ env: 'test' })),
      makeHook('pkg', 'after:defaults', () => ({ version: '1.0.0' })),
      makeHook('other', 'before:global', () => ({ other: true })),
    ];

    const layers = runHooksSync(hooks, 'before:defaults', context);

    expect(layers).toHaveLength(1);
    expect(layers[0]!.hookName).toBe('env');
  });

  it('throws TypeError when a hook returns a Promise', () => {
    const hooks = [
      makeHook('async', 'before:defaults', () =>
        Promise.resolve({ key: 'value' }),
      ),
    ];

    expect(() => runHooksSync(hooks, 'before:defaults', context)).toThrow(
      'morsel: hook "async" is async — use loadConfig or watchConfig',
    );
  });

  it.each([
    ['null', null, null],
    [
      'fake thenable',
      JSON.parse('{"then": "not a function"}') as Record<string, unknown>,
      JSON.parse('{"then": "not a function"}'),
    ],
    ['primitive', 42 as unknown as Record<string, unknown>, 42],
  ])(
    'treats %s return value as a sync result, not a Promise',
    (_label, value, expected) => {
      const hooks = [
        makeHook(
          'test-hook',
          'before:defaults',
          () => value as unknown as Record<string, unknown>,
        ),
      ];

      const layers = runHooksSync(hooks, 'before:defaults', context);

      expect(layers).toHaveLength(1);
      expect(layers[0]!.config).toEqual(expected);
    },
  );

  it('throws MorselError with EHOOK when a hook throws', () => {
    const hooks = [
      makeHook('boom', 'before:defaults', () => {
        throw new Error('kaboom');
      }),
    ];

    expect(() => runHooksSync(hooks, 'before:defaults', context)).toThrow(
      MorselError,
    );
    expect(() => runHooksSync(hooks, 'before:defaults', context)).toThrow(
      'hook "boom" failed in before:defaults: kaboom',
    );
  });

  it('preserves the original error message as cause in EHOOK', () => {
    const original = new Error('kaboom');
    const hooks = [
      makeHook('boom', 'after:global', () => {
        throw original;
      }),
    ];

    try {
      runHooksSync(hooks, 'after:global', context);
    } catch (error) {
      expect(error).toBeInstanceOf(MorselError);
      expect((error as MorselError).code).toBe('EHOOK');
      expect((error as MorselError).path).toBeUndefined();
      expect((error as MorselError).cause).toBeInstanceOf(Error);
      expect((error as MorselError).cause.message).toContain('kaboom');
    }
  });
});

describe('runHooks', () => {
  it('returns empty array when no hooks match the lifecycle', async () => {
    const hooks = [makeHook('env', 'after:defaults', () => ({ key: 'value' }))];

    const layers = await runHooks(hooks, 'before:defaults', context);

    expect(layers).toEqual([]);
  });

  it('produces a hook layer for each matching sync hook', async () => {
    const hooks = [makeHook('env', 'before:defaults', () => ({ env: 'test' }))];

    const layers = await runHooks(hooks, 'before:defaults', context);

    expect(layers).toHaveLength(1);
    expect(layers[0]).toMatchObject({
      source: 'hook',
      hookName: 'env',
      config: { env: 'test' },
    });
  });

  it('awaits async hooks and produces layers', async () => {
    const hooks = [
      makeHook('async', 'before:defaults', () =>
        Promise.resolve({ key: 'value' }),
      ),
    ];

    const layers = await runHooks(hooks, 'before:defaults', context);

    expect(layers).toHaveLength(1);
    expect(layers[0]!.hookName).toBe('async');
    expect(layers[0]!.config).toEqual({ key: 'value' });
  });

  it('mixes sync and async hooks in order', async () => {
    const hooks = [
      makeHook('sync', 'before:defaults', () => ({ sync: true })),
      makeHook('async', 'before:defaults', () =>
        Promise.resolve({ async: true }),
      ),
    ];

    const layers = await runHooks(hooks, 'before:defaults', context);

    expect(layers).toHaveLength(2);
    expect(layers[0]!.hookName).toBe('sync');
    expect(layers[1]!.hookName).toBe('async');
  });

  it.each([
    [
      'sync throw',
      () => {
        throw new Error('kaboom');
      },
      'hook "boom" failed in before:defaults: kaboom',
    ],
    [
      'async reject',
      () => Promise.reject(new Error('async kaboom')),
      'hook "boom" failed in before:defaults: async kaboom',
    ],
  ])(
    'throws MorselError with EHOOK when a hook %s',
    async (_label, load, expectedMessage) => {
      const hooks = [makeHook('boom', 'before:defaults', load)];

      await expect(runHooks(hooks, 'before:defaults', context)).rejects.toThrow(
        MorselError,
      );
      await expect(runHooks(hooks, 'before:defaults', context)).rejects.toThrow(
        expectedMessage,
      );
      await expect(
        runHooks(hooks, 'before:defaults', context),
      ).rejects.toMatchObject({ code: 'EHOOK' });
    },
  );
});

describe('runWriteHooks', () => {
  const writeEvent: WriteEvent = {
    filePath: '/project/config.json',
    keyPath: 'server.port',
    mutation: { path: 'server.port', value: 8080 },
  };
  const onDebug = vi.fn();

  function makeEventHook(
    name: string,
    onWrite: EventHook['onWrite'],
  ): EventHook {
    return { name, lifecycle: 'after:write', onWrite };
  }

  beforeEach(() => {
    onDebug.mockClear();
  });

  it('calls onWrite for each after:write hook', async () => {
    const onWrite1 = vi.fn();
    const onWrite2 = vi.fn();
    const hooks = [
      makeEventHook('audit', onWrite1),
      makeEventHook('metrics', onWrite2),
    ];

    await runWriteHooks(hooks, writeEvent, onDebug);

    expect(onWrite1).toHaveBeenCalledWith(writeEvent);
    expect(onWrite2).toHaveBeenCalledWith(writeEvent);
  });

  it('skips non-event hooks', async () => {
    const onWrite = vi.fn();
    const hooks = [
      makeEventHook('audit', onWrite),
      makeHook('env', 'before:defaults', () => ({ env: 'test' })),
    ];

    await runWriteHooks(hooks, writeEvent, onDebug);

    expect(onWrite).toHaveBeenCalledTimes(1);
    expect(onDebug).not.toHaveBeenCalled();
  });

  it('awaits async onWrite', async () => {
    const onWrite = vi.fn().mockResolvedValue(undefined);
    const hooks = [makeEventHook('async-audit', onWrite)];

    await runWriteHooks(hooks, writeEvent, onDebug);

    expect(onWrite).toHaveBeenCalledTimes(1);
  });

  it('catches and logs onWrite errors via onDebug', async () => {
    const onWrite = vi.fn().mockRejectedValue(new Error('log server down'));
    const hooks = [makeEventHook('audit', onWrite)];

    await runWriteHooks(hooks, writeEvent, onDebug);

    expect(onDebug).toHaveBeenCalledWith(
      'hook "audit" failed in after:write: log server down',
      { hookName: 'audit', event: writeEvent },
    );
  });

  it('continues running remaining hooks after one fails', async () => {
    const onWrite1 = vi.fn().mockRejectedValue(new Error('fail'));
    const onWrite2 = vi.fn();
    const hooks = [
      makeEventHook('failing', onWrite1),
      makeEventHook('ok', onWrite2),
    ];

    await runWriteHooks(hooks, writeEvent, onDebug);

    expect(onWrite2).toHaveBeenCalledWith(writeEvent);
  });

  it('does nothing with empty hooks', async () => {
    await runWriteHooks([], writeEvent, onDebug);

    expect(onDebug).not.toHaveBeenCalled();
  });
});

describe('EventHook integration with runHooksSync/runHooks', () => {
  const context: HookContext = {
    cwd: '/fake',
    envName: 'test',
    triggerRemerge: () => {},
  };

  it('runHooksSync skips EventHook even when lifecycle matches', () => {
    const onWrite = vi.fn();
    const eventHook: EventHook = {
      name: 'audit',
      lifecycle: 'after:write',
      onWrite,
    };

    const layers = runHooksSync([eventHook], 'after:write', context);

    expect(layers).toEqual([]);
    expect(onWrite).not.toHaveBeenCalled();
  });

  it('runHooksSync skips EventHook alongside LayerHook', () => {
    const eventHook: EventHook = {
      name: 'audit',
      lifecycle: 'after:write',
      onWrite: vi.fn(),
    };

    const layers = runHooksSync(
      [eventHook, makeHook('env', 'before:defaults', () => ({ env: 'test' }))],
      'before:defaults',
      context,
    );

    expect(layers).toHaveLength(1);
    expect(layers[0]!.hookName).toBe('env');
  });

  it('runHooks skips EventHook even when lifecycle matches', async () => {
    const onWrite = vi.fn();
    const eventHook: EventHook = {
      name: 'audit',
      lifecycle: 'after:write',
      onWrite,
    };

    const layers = await runHooks([eventHook], 'after:write', context);

    expect(layers).toEqual([]);
    expect(onWrite).not.toHaveBeenCalled();
  });

  it('runHooks skips EventHook alongside LayerHook', async () => {
    const eventHook: EventHook = {
      name: 'audit',
      lifecycle: 'after:write',
      onWrite: vi.fn(),
    };

    const layers = await runHooks(
      [eventHook, makeHook('env', 'before:defaults', () => ({ env: 'test' }))],
      'before:defaults',
      context,
    );

    expect(layers).toHaveLength(1);
    expect(layers[0]!.hookName).toBe('env');
  });
});
