import type { ResolvedLayer } from '@/load/resolve-layer';
import { toMorselLayer } from '@/store/layer';

describe('toMorselLayer', () => {
  it('maps all fields from ResolvedLayer to MorselLayer', () => {
    const layer: ResolvedLayer = {
      source: 'global',
      path: '/path/to/config.json',
      config: { foo: 'bar' },
      exists: true,
      extendsPaths: [],
    };

    const result = toMorselLayer(layer, 'myapp');

    expect(result.source).toBe('global');
    expect(result.path).toBe('/path/to/config.json');
    expect(result.exists).toBe(true);
    expect(result.configName).toBe('myapp');
  });

  it('freezes the config object', () => {
    const layer: ResolvedLayer = {
      source: 'defaults',
      path: undefined,
      config: { foo: 'bar' },
      exists: true,
      extendsPaths: [],
    };

    const result = toMorselLayer(layer, 'myapp');

    expect(Object.isFrozen(result.config)).toBe(true);
  });

  it('deep freezes nested objects', () => {
    const layer: ResolvedLayer = {
      source: 'project',
      path: '/project/config.json',
      config: { nested: { inner: { deep: true } } },
      exists: true,
      extendsPaths: [],
    };

    const result = toMorselLayer(layer, 'myapp');

    expect(Object.isFrozen(result.config)).toBe(true);
    expect(Object.isFrozen(result.config['nested'])).toBe(true);
    expect(
      Object.isFrozen(
        (result.config['nested'] as Record<string, unknown>)['inner'],
      ),
    ).toBe(true);
  });

  it('does not freeze null values', () => {
    const layer: ResolvedLayer = {
      source: 'defaults',
      path: undefined,
      config: { foo: null },
      exists: true,
      extendsPaths: [],
    };

    const result = toMorselLayer(layer, 'myapp');

    expect(result.config['foo']).toBe(null);
    expect(Object.isFrozen(result.config)).toBe(true);
  });

  it('freezes arrays recursively', () => {
    const layer: ResolvedLayer = {
      source: 'defaults',
      path: undefined,
      config: { items: [1, 2, 3] },
      exists: true,
      extendsPaths: [],
    };

    const result = toMorselLayer(layer, 'myapp');

    expect(Object.isFrozen(result.config)).toBe(true);
    expect(Object.isFrozen(result.config['items'])).toBe(true);
  });

  it('does not freeze primitive values', () => {
    const layer: ResolvedLayer = {
      source: 'defaults',
      path: undefined,
      config: { num: 42, str: 'hello', bool: true },
      exists: true,
      extendsPaths: [],
    };

    const result = toMorselLayer(layer, 'myapp');

    expect(result.config['num']).toBe(42);
    expect(result.config['str']).toBe('hello');
    expect(result.config['bool']).toBe(true);
  });

  it('does not freeze function values', () => {
    const function_ = (): void => {};
    const layer: ResolvedLayer = {
      source: 'defaults',
      path: undefined,
      config: { fn: function_ },
      exists: true,
      extendsPaths: [],
    };

    const result = toMorselLayer(layer, 'myapp');

    expect(typeof result.config['fn']).toBe('function');
    expect(Object.isFrozen(result.config['fn'])).toBe(false);
  });

  it('does not re-freeze already frozen nested objects', () => {
    const frozenInner = Object.freeze({ deep: true });
    const layer: ResolvedLayer = {
      source: 'defaults',
      path: undefined,
      config: { nested: frozenInner },
      exists: true,
      extendsPaths: [],
    };

    const result = toMorselLayer(layer, 'myapp');

    expect(Object.isFrozen(result.config)).toBe(true);
    expect(Object.isFrozen(result.config['nested'])).toBe(true);
    expect(result.config['nested']).toBe(frozenInner);
  });

  it('handles circular references without throwing (cycle protection)', () => {
    const config: Record<string, unknown> = { foo: 'bar' };
    config['self'] = config;
    const layer: ResolvedLayer = {
      source: 'defaults',
      path: undefined,
      config,
      exists: true,
      extendsPaths: [],
    };

    const result = toMorselLayer(layer, 'myapp');
    expect(Object.isFrozen(result.config)).toBe(true);
    // Circular ref preserved — self points back to the original config object
    expect(Object.isFrozen(result.config['self'])).toBe(true);
  });

  it('creates a shallow copy of config before freezing', () => {
    const originalConfig = { foo: 'bar' };
    const layer: ResolvedLayer = {
      source: 'defaults',
      path: undefined,
      config: originalConfig,
      exists: true,
      extendsPaths: [],
    };

    const result = toMorselLayer(layer, 'myapp');

    expect(result.config).not.toBe(originalConfig);
    expect(result.config).toEqual({ foo: 'bar' });
    expect(Object.isFrozen(originalConfig)).toBe(false);
  });

  it('handles empty config object', () => {
    const layer: ResolvedLayer = {
      source: 'defaults',
      path: undefined,
      config: {},
      exists: true,
      extendsPaths: [],
    };

    const result = toMorselLayer(layer, 'myapp');

    expect(result.config).toEqual({});
    expect(Object.isFrozen(result.config)).toBe(true);
  });

  it('handles false exists flag', () => {
    const layer: ResolvedLayer = {
      source: 'global',
      path: '/missing/config.json',
      config: {},
      exists: false,
      extendsPaths: [],
    };

    const result = toMorselLayer(layer, 'myapp');

    expect(result.exists).toBe(false);
  });

  it('handles undefined values in config', () => {
    const layer: ResolvedLayer = {
      source: 'defaults',
      path: undefined,
      config: { foo: undefined },
      exists: true,
      extendsPaths: [],
    };

    const result = toMorselLayer(layer, 'myapp');

    expect(result.config['foo']).toBe(undefined);
    expect(Object.isFrozen(result.config)).toBe(true);
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

    const result = toMorselLayer(layer, 'myapp');

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

    const result = toMorselLayer(layer, 'myapp');

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

    const result = toMorselLayer(layer, 'myapp');

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

    const result = toMorselLayer(layer, 'myapp');

    expect(Object.isFrozen(result.extendsPaths)).toBe(true);
  });
});
