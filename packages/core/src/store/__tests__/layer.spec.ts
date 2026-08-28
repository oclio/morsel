import type { ResolvedLayer } from '@/load/resolve-layer';
import { toMorselLayer } from '@/store/layer';
import { deepFreeze } from '@/utils/deep-freeze';

vi.mock('@/utils/deep-freeze', () => ({
  deepFreeze: vi.fn((value: Record<string, unknown>) =>
    Object.freeze({ ...value }),
  ),
}));

describe('toMorselLayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps all fields from ResolvedLayer to MorselLayer', () => {
    const layer: ResolvedLayer = {
      source: 'global',
      path: '/path/to/config.json',
      config: { foo: 'bar' },
      exists: true,
      extendsPaths: [],
    };

    const result = toMorselLayer(layer);

    expect(result.source).toBe('global');
    expect(result.path).toBe('/path/to/config.json');
    expect(result.exists).toBe(true);
  });

  it('calls deepFreeze with a shallow copy of the config', () => {
    const config = { foo: 'bar' };
    const layer: ResolvedLayer = {
      source: 'defaults',
      path: undefined,
      config,
      exists: true,
      extendsPaths: [],
    };

    toMorselLayer(layer);

    expect(deepFreeze).toHaveBeenCalledTimes(1);
    const frozenArgument = vi.mocked(deepFreeze).mock.calls[0]![0];
    expect(frozenArgument).toEqual(config);
    expect(frozenArgument).not.toBe(config);
  });

  it('handles false exists flag', () => {
    const layer: ResolvedLayer = {
      source: 'global',
      path: '/missing/config.json',
      config: {},
      exists: false,
      extendsPaths: [],
    };

    const result = toMorselLayer(layer);

    expect(result.exists).toBe(false);
  });

  it('handles empty config object', () => {
    const layer: ResolvedLayer = {
      source: 'defaults',
      path: undefined,
      config: {},
      exists: true,
      extendsPaths: [],
    };

    const result = toMorselLayer(layer);

    expect(result.config).toEqual({});
  });

  it('includes hookName when source is hook', () => {
    const layer: ResolvedLayer = {
      source: 'hook',
      hookName: 'env',
      path: undefined,
      config: { env: 'test' },
      exists: true,
      extendsPaths: [],
    };

    const result = toMorselLayer(layer);

    expect(result.source).toBe('hook');
    expect(result.hookName).toBe('env');
  });

  it('omits hookName when layer has no hookName', () => {
    const layer: ResolvedLayer = {
      source: 'defaults',
      path: undefined,
      config: {},
      exists: true,
      extendsPaths: [],
    };

    const result = toMorselLayer(layer);

    expect(result).not.toHaveProperty('hookName');
  });

  it('propagates extendsPaths from ResolvedLayer', () => {
    const layer: ResolvedLayer = {
      source: 'project',
      path: '/project/config.json',
      config: {},
      exists: true,
      extendsPaths: ['/base.json', '/shared.json'],
    };

    const result = toMorselLayer(layer);

    expect(result.extendsPaths).toEqual(['/base.json', '/shared.json']);
  });

  it('freezes extendsPaths array', () => {
    const layer: ResolvedLayer = {
      source: 'project',
      path: '/project/config.json',
      config: {},
      exists: true,
      extendsPaths: ['/base.json'],
    };

    const result = toMorselLayer(layer);

    expect(Object.isFrozen(result.extendsPaths)).toBe(true);
  });
});
