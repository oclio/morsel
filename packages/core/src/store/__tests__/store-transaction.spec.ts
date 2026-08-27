import { promises as fs } from 'node:fs';

import { createMockLayer, createMockStoreState } from '@oclio/test-helpers';

import { runWriteHooks } from '@/hooks/run-hooks';
import { selectParser } from '@/plugins/select-parser';
import { emitChanges } from '@/store/reactive/emit-changes';
import type { StoreState } from '@/store/store-state';
import { runTransaction, trackDirtyKey } from '@/store/store-transaction';
import type { ConfigRecord, MorselLayer } from '@/store/types';

vi.mock('node:fs', () => ({
  promises: {
    copyFile: vi.fn(),
    rename: vi.fn(),
    unlink: vi.fn(),
    mkdir: vi.fn(),
    writeFile: vi.fn(),
  },
}));
vi.mock('node:path', () => ({
  default: {
    dirname: vi.fn(() => '/dir'),
  },
}));
vi.mock('@/hooks/run-hooks', () => ({
  runWriteHooks: vi.fn(),
}));
vi.mock('@/plugins/select-parser', () => ({
  selectParser: vi.fn(),
}));
vi.mock('@/store/reactive/emit-changes', () => ({
  emitChanges: vi.fn(),
}));

function createLayer(
  source: 'project' | 'global',
  filePath: string,
  config: ConfigRecord,
): MorselLayer {
  return createMockLayer({
    source,
    path: filePath,
    config,
  }) as MorselLayer;
}

function createState<T extends ConfigRecord>(
  overrides: Partial<StoreState<T>> = {},
): StoreState<T> {
  const projectPath = '/project/config.json';
  return createMockStoreState<T>({
    _config: { port: 3000 } as unknown as T,
    _layers: [createLayer('project', projectPath, { port: 3000 })],
    projectPath,
    options: {
      formatPlugins: [],
      hooks: [],
      onDebug: vi.fn(),
    },
    lastConfig: { port: 3000 },
    ...overrides,
  }) as unknown as StoreState<T>;
}

describe('runTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(selectParser).mockReturnValue({
      extensions: ['.json'],
      parse: vi.fn(),
      serialize: vi.fn(() => '{}'),
    } as never);
    vi.mocked(fs.copyFile).mockResolvedValue(undefined);
    vi.mocked(fs.rename).mockResolvedValue(undefined);
    vi.mocked(fs.unlink).mockResolvedValue(undefined);
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
  });

  it('throws if store is stopped', async () => {
    const state = createState({ stopped: true });
    await expect(
      runTransaction(state, 'frozen', async () => {}),
    ).rejects.toThrow('morsel: store is stopped');
  });

  it('throws on nested transaction', async () => {
    const state = createState({ inTransaction: true });
    await expect(
      runTransaction(state, 'frozen', async () => {}),
    ).rejects.toThrow('nested transactions');
  });

  it('empty transaction: 0 writes, 0 errors', async () => {
    const state = createState();
    await runTransaction(state, 'frozen', async () => {});
    expect(fs.copyFile).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
    expect(fs.unlink).not.toHaveBeenCalled();
    expect(fs.rename).not.toHaveBeenCalled();
    expect(state.inTransaction).toBe(false);
    expect(state.transactionDirtyKeys.size).toBe(0);
  });

  it('sets inTransaction=true during callback', async () => {
    const state = createState();
    let isSeenFlag = false;
    await runTransaction(state, 'frozen', async () => {
      isSeenFlag = state.inTransaction;
    });
    expect(isSeenFlag).toBe(true);
    expect(state.inTransaction).toBe(false);
  });

  it('rollback on callback throw: restores config, no writes', async () => {
    const state = createState();
    const originalConfig = state._config;
    const originalLayers = state._layers;
    await expect(
      runTransaction(state, 'frozen', async () => {
        state._config = { port: 9999 } as never;
        state.transactionDirtyKeys.set(
          '/project/config.json',
          new Set(['port']),
        );
        throw new Error('callback failed');
      }),
    ).rejects.toThrow('callback failed');
    expect(state._config).toBe(originalConfig);
    expect(state._layers).toBe(originalLayers);
    expect(fs.writeFile).not.toHaveBeenCalled();
    expect(state.inTransaction).toBe(false);
  });

  it('emits events after successful commit', async () => {
    const state = createState();
    await runTransaction(state, 'frozen', async () => {
      state._config = { port: 8080 } as never;
      state.lastConfig = { port: 8080 };
      state.transactionDirtyKeys.set('/project/config.json', new Set(['port']));
    });
    expect(emitChanges).toHaveBeenCalledOnce();
  });

  it('does not emit events on rollback', async () => {
    const state = createState();
    await expect(
      runTransaction(state, 'frozen', async () => {
        throw new Error('fail');
      }),
    ).rejects.toThrow('fail');
    expect(emitChanges).not.toHaveBeenCalled();
  });

  it('writes dirty layers on commit', async () => {
    const state = createState();
    await runTransaction(state, 'frozen', async () => {
      state.transactionDirtyKeys.set('/project/config.json', new Set(['port']));
    });
    expect(fs.copyFile).toHaveBeenCalledWith(
      '/project/config.json',
      '/project/config.json.bak',
    );
    expect(fs.mkdir).toHaveBeenCalledWith('/dir', { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/^\/project\/config\.json\.tmp\.\d+$/),
      '{}',
      'utf8',
    );
    expect(fs.rename).toHaveBeenCalledWith(
      expect.stringMatching(/^\/project\/config\.json\.tmp\.\d+$/),
      '/project/config.json',
    );
    expect(fs.unlink).toHaveBeenCalledWith('/project/config.json.bak');
  });

  it('skips layers without dirty keys', async () => {
    const state = createState({
      _layers: [
        createLayer('project', '/project/config.json', { port: 3000 }),
        createLayer('global', '/global/config.json', { host: 'localhost' }),
      ] as MorselLayer[],
    });
    await runTransaction(state, 'frozen', async () => {
      state.transactionDirtyKeys.set('/project/config.json', new Set(['port']));
    });
    expect(fs.copyFile).toHaveBeenCalledTimes(1);
    expect(fs.copyFile).toHaveBeenCalledWith(
      '/project/config.json',
      '/project/config.json.bak',
    );
  });

  it('restores .bak on commit write failure', async () => {
    const state = createState();
    const originalConfig = state._config;
    const originalLayers = state._layers;
    vi.mocked(fs.writeFile).mockRejectedValueOnce(new Error('disk full'));
    await expect(
      runTransaction(state, 'frozen', async () => {
        state._config = { port: 9999 } as never;
        state.transactionDirtyKeys.set(
          '/project/config.json',
          new Set(['port']),
        );
      }),
    ).rejects.toThrow('disk full');
    expect(fs.rename).toHaveBeenCalledWith(
      '/project/config.json.bak',
      '/project/config.json',
    );
    expect(state._config).toBe(originalConfig);
    expect(state._layers).toBe(originalLayers);
    expect(state.inTransaction).toBe(false);
  });

  it('runs after:write hooks per written file', async () => {
    const state = createState();
    await runTransaction(state, 'frozen', async () => {
      state.transactionDirtyKeys.set('/project/config.json', new Set(['port']));
    });
    expect(runWriteHooks).toHaveBeenCalledOnce();
    expect(runWriteHooks).toHaveBeenCalledWith(
      [],
      {
        filePath: '/project/config.json',
        keyPath: '*',
        mutation: { path: '*' },
      },
      state.options.onDebug,
    );
  });

  it('throws when no format plugin found for dirty layer', async () => {
    const state = createState();
    vi.mocked(selectParser).mockReturnValue(undefined as never);
    await expect(
      runTransaction(state, 'frozen', async () => {
        state.transactionDirtyKeys.set(
          '/project/config.json',
          new Set(['port']),
        );
      }),
    ).rejects.toThrow('No format plugin found');
  });

  it('skips backup when file does not exist (ENOENT)', async () => {
    const state = createState();
    const enoentError = new Error('ENOENT') as NodeJS.ErrnoException;
    enoentError.code = 'ENOENT';
    vi.mocked(fs.copyFile).mockRejectedValueOnce(enoentError);
    await runTransaction(state, 'frozen', async () => {
      state.transactionDirtyKeys.set('/project/config.json', new Set(['port']));
    });
    expect(fs.writeFile).toHaveBeenCalled();
    expect(state.inTransaction).toBe(false);
  });

  it('rethrows non-ENOENT backup errors', async () => {
    const state = createState();
    vi.mocked(fs.copyFile).mockRejectedValueOnce(
      new Error('permission denied'),
    );
    await expect(
      runTransaction(state, 'frozen', async () => {
        state.transactionDirtyKeys.set(
          '/project/config.json',
          new Set(['port']),
        );
      }),
    ).rejects.toThrow('permission denied');
    expect(fs.rename).not.toHaveBeenCalled();
  });

  it('ignores .bak cleanup errors on success', async () => {
    const state = createState();
    vi.mocked(fs.unlink).mockRejectedValueOnce(new Error('EBUSY'));
    await runTransaction(state, 'frozen', async () => {
      state.transactionDirtyKeys.set('/project/config.json', new Set(['port']));
    });
    expect(state.inTransaction).toBe(false);
  });
});

describe('trackDirtyKey', () => {
  it('adds key to existing layer set', () => {
    const state = createState();
    const existing = new Set<string>(['foo']);
    state.transactionDirtyKeys.set('/project/config.json', existing);
    trackDirtyKey(state, '/project/config.json', 'bar');
    expect(existing.has('bar')).toBe(true);
  });

  it('creates new set for unknown layer', () => {
    const state = createState();
    trackDirtyKey(state, '/project/config.json', 'port');
    const set = state.transactionDirtyKeys.get('/project/config.json');
    expect(set).toBeDefined();
    expect(set?.has('port')).toBe(true);
  });
});
