import { getWritableTargetFile } from '@/store/store-mutation-helpers';
import type { StoreState } from '@/store/store-state';
import { resolveKeyOrigin } from '@/writer/resolve-origin';

vi.mock('@/writer/resolve-origin', () => ({
  resolveKeyOrigin: vi.fn(),
}));

function createState(overrides: Partial<StoreState> = {}): StoreState {
  return {
    _config: {},
    _proxy: undefined,
    _stoppedConfig: undefined,
    _layers: [],
    listeners: new Map(),
    wildcardListeners: new Map(),
    stopped: false,
    watchers: new Set(),
    watchedFiles: new Map(),
    projectPath: '/project/config.json',
    options: {} as never,
    lastConfig: {},
    remergeInProgress: false,
    remergeDone: undefined,
    pendingRemerge: false,
    debounceTimers: new Map(),
    debounceMs: 300,
    remerge: vi.fn(),
    enoentLogged: new Set(),
    writeQueue: Promise.resolve(),
    queueEnabled: true,
    inTransaction: false,
    transactionDirtyKeys: new Map(),
    ...overrides,
  } as StoreState;
}

describe('store-mutation-helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns origin filePath when writable', () => {
    vi.mocked(resolveKeyOrigin).mockReturnValue({
      filePath: '/origin/config.json',
      layer: undefined,
      isWritable: true,
      exists: true,
    });

    const state = createState();

    const result = getWritableTargetFile('key', state);

    expect(result).toBe('/origin/config.json');
  });

  it('falls back to projectPath when origin is not writable', () => {
    vi.mocked(resolveKeyOrigin).mockReturnValue({
      filePath: '/origin/config.json',
      layer: undefined,
      isWritable: false,
      exists: true,
    });

    const state = createState({ projectPath: '/fallback/config.json' });

    const result = getWritableTargetFile('key', state);

    expect(result).toBe('/fallback/config.json');
  });

  it('falls back to projectPath when origin has no filePath', () => {
    vi.mocked(resolveKeyOrigin).mockReturnValue({
      filePath: undefined,
      layer: undefined,
      isWritable: true,
      exists: true,
    });

    const state = createState({ projectPath: '/fallback/config.json' });

    const result = getWritableTargetFile('key', state);

    expect(result).toBe('/fallback/config.json');
  });

  it('throws when no writable file is found', () => {
    vi.mocked(resolveKeyOrigin).mockReturnValue({
      filePath: undefined,
      layer: undefined,
      isWritable: false,
      exists: false,
    });

    const state = createState({ projectPath: undefined });

    expect(() => getWritableTargetFile('key', state)).toThrow(
      'morsel: cannot write "key" — no writable file found',
    );
  });
});
