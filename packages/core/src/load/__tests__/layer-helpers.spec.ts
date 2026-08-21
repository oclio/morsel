import {
  buildFileLayer,
  buildHookLayer,
  buildRawLayer,
} from '@/load/layer-helpers';

describe('buildRawLayer', () => {
  it.each([
    {
      name: 'builds defaults layer with config',
      source: 'defaults' as const,
      config: { foo: 'bar' },
    },
    {
      name: 'builds overrides layer with config',
      source: 'overrides' as const,
      config: { baz: 42 },
    },
    {
      name: 'builds layer with empty config',
      source: 'defaults' as const,
      config: {},
    },
    {
      name: 'builds layer with nested config',
      source: 'project' as const,
      config: { nested: { a: 1, b: 2 } },
    },
  ])('$name', ({ source, config }) => {
    const result = buildRawLayer(source, config);

    expect(result).toEqual({
      source,
      path: undefined,
      exists: true,
      config,
      extendsPaths: [],
    });
  });
});

describe('buildFileLayer', () => {
  it.each([
    {
      name: 'builds existing layer with config and extends paths',
      source: 'project' as const,
      filePath: '/fake/config.json',
      result: {
        exists: true,
        config: { foo: 'bar' },
        extendsPaths: ['/fake/base.json'],
      },
      expected: {
        source: 'project',
        path: '/fake/config.json',
        exists: true,
        config: { foo: 'bar' },
        extendsPaths: ['/fake/base.json'],
      },
    },
    {
      name: 'builds non-existing layer with empty config',
      source: 'global' as const,
      filePath: '/fake/missing.json',
      result: {
        exists: false,
        config: {},
        extendsPaths: [],
      },
      expected: {
        source: 'global',
        path: '/fake/missing.json',
        exists: false,
        config: {},
        extendsPaths: [],
      },
    },
    {
      name: 'builds existing layer with empty extends paths',
      source: 'project' as const,
      filePath: '/fake/config.json',
      result: {
        exists: true,
        config: { foo: 'bar' },
        extendsPaths: [],
      },
      expected: {
        source: 'project',
        path: '/fake/config.json',
        exists: true,
        config: { foo: 'bar' },
        extendsPaths: [],
      },
    },
    {
      name: 'builds non-existing layer with extends paths in result but empty in output',
      source: 'global' as const,
      filePath: '/fake/missing.json',
      result: {
        exists: false,
        config: { should: 'be ignored' },
        extendsPaths: ['/fake/should-be-ignored.json'],
      },
      expected: {
        source: 'global',
        path: '/fake/missing.json',
        exists: false,
        config: {},
        extendsPaths: [],
      },
    },
  ])('$name', ({ source, filePath, result, expected }) => {
    const output = buildFileLayer(source, filePath, result);

    expect(output).toEqual(expected);
  });
});

describe('buildHookLayer', () => {
  it.each([
    {
      name: 'builds hook layer with config',
      hookName: 'env',
      config: { NODE_ENV: 'test' },
    },
    {
      name: 'builds hook layer with empty config',
      hookName: 'noop',
      config: {},
    },
    {
      name: 'builds hook layer with nested config',
      hookName: 'package-json',
      config: { version: '1.0.0', scripts: { build: 'tsup' } },
    },
  ])('$name', ({ hookName, config }) => {
    const result = buildHookLayer(hookName, config);

    expect(result).toEqual({
      source: 'hook',
      hookName,
      path: undefined,
      exists: true,
      config,
      extendsPaths: [],
    });
  });
});
