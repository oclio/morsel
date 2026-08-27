import { vi } from 'vitest';

type MockFunction = ReturnType<typeof vi.fn>;

interface StoreMockFns {
  applyValidation?: unknown;
  applyMutability?: unknown;
  mergeLayers?: unknown;
  interpolate?: unknown;
  processConfig?: unknown;
  toMorselLayer?: unknown;
  deepClone?: unknown;
  parsePath?: unknown;
  setPathValue?: unknown;
  hasRemovedPathValue?: unknown;
  getPathValue?: unknown;
  emitChanges?: unknown;
  resolveKeyOrigin?: unknown;
  writeConfigFile?: unknown;
  runWriteHooks?: unknown;
}

function asMock(function_: unknown): MockFunction | undefined {
  return function_ as MockFunction | undefined;
}

/**
 * Set up default mock implementations for common store dependencies.
 *
 * Calls `vi.clearAllMocks()` first, then configures each provided function
 * with a sensible default implementation. Only functions present in the
 * `fns` object are configured — pass `undefined` or omit keys for mocks
 * that should remain unconfigured.
 *
 * @param fns - Mocked functions to configure (imported + vi.mock'd in the test file).
 */
export function setupStoreMocks(fns: StoreMockFns): void {
  vi.clearAllMocks();

  asMock(fns.applyValidation)?.mockImplementation((config: unknown) => config);
  asMock(fns.applyMutability)?.mockImplementation((config: unknown) => config);
  asMock(fns.mergeLayers)?.mockImplementation((layers: unknown[]) => {
    let merged: Record<string, unknown> = {};
    for (const layer of layers) {
      merged = {
        ...merged,
        ...(layer as { config: Record<string, unknown> }).config,
      };
    }
    return merged;
  });
  asMock(fns.interpolate)?.mockImplementation((config: unknown) => config);
  asMock(fns.processConfig)?.mockImplementation(
    (
      layers: unknown[],
      _arrayMerge: unknown,
      _plugins: unknown,
      mutability: unknown,
    ) => {
      let merged: Record<string, unknown> = {};
      for (const layer of layers) {
        merged = {
          ...merged,
          ...(layer as { config: Record<string, unknown> }).config,
        };
      }
      const validated = merged;
      const config = validated;
      const lastConfig =
        mutability === 'mutable' ? structuredClone(validated) : validated;
      return { config, validated, lastConfig };
    },
  );
  asMock(fns.toMorselLayer)?.mockImplementation((layer: unknown) => layer);
  asMock(fns.deepClone)?.mockImplementation(
    (config: unknown) => structuredClone(config) as Record<string, unknown>,
  );
  asMock(fns.parsePath)?.mockImplementation((path: unknown) =>
    typeof path === 'string' ? path.split('.') : [...(path as unknown[])],
  );
  asMock(fns.setPathValue)?.mockImplementation(
    (object: unknown, segments: unknown[], value: unknown) => {
      let current = object as Record<string, unknown>;
      for (let index = 0; index < segments.length - 1; index++) {
        if (current[segments[index] as string] === undefined) {
          current[segments[index] as string] = {};
        }
        current = current[segments[index] as string] as Record<string, unknown>;
      }
      current[segments.at(-1) as string] = value;
    },
  );
  asMock(fns.hasRemovedPathValue)?.mockReturnValue(true);
  asMock(fns.getPathValue)?.mockImplementation(
    (object: unknown, path: unknown) => {
      const segments =
        typeof path === 'string' ? path.split('.') : [...(path as unknown[])];
      let current: unknown = object;
      for (const seg of segments) {
        current = (current as Record<string, unknown>)?.[seg as string];
      }
      return current;
    },
  );
  asMock(fns.emitChanges)?.mockImplementation(() => {
    /**
    noop — emitChanges returns void
    */
  });
  asMock(fns.resolveKeyOrigin)?.mockReturnValue({
    filePath: '/project/config.json',
    layer: {
      source: 'project',
      path: '/project/config.json',
      config: {},
      exists: true,
      extendsPaths: [],
    },
    isWritable: true,
    exists: true,
  });
  asMock(fns.writeConfigFile)?.mockResolvedValue(undefined);
  asMock(fns.runWriteHooks)?.mockResolvedValue(undefined);
}
