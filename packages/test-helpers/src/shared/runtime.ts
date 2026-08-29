type ConfigRecord = Record<string, unknown>;

/**
Options passed to `loadConfig` / `createReactiveStore` at runtime.
*/
export type RuntimeOptions = ConfigRecord & { readonly name: string };

/**
Minimal representation of a config layer (project, global, hook, …).
*/
export interface MinimalLayer {
  readonly source: string;
  readonly path: string | undefined;
  readonly config: ConfigRecord;
  readonly exists: boolean;
  readonly extendsPaths: readonly string[];
  readonly hookName?: string;
}

/**
Result returned by `loadConfig` — merged config plus layer stack.
*/
export interface ConfigResultLike {
  readonly config: ConfigRecord;
  readonly layers: readonly MinimalLayer[];
}

/**
Minimal store interface returned by `createReactiveStore`.
*/
export interface StoreLike {
  readonly config: ConfigRecord;
  readonly layers: readonly MinimalLayer[];
  on(
    key: string,
    listener: (event: {
      readonly keyPath: string;
      readonly type: string;
      readonly next: unknown;
      readonly prev: unknown;
    }) => void,
    options?: Record<string, never>,
  ): () => void;
  stop(): Promise<void>;
}

/**
Runtime facade exposed by `@oclio/morsel` and consumed by test helpers.
*/
export interface MorselRuntime {
  loadConfig: (options: RuntimeOptions) => Promise<ConfigResultLike>;
  loadConfigSync?: (options: RuntimeOptions) => ConfigResultLike;
  createReactiveStore: (options: RuntimeOptions) => Promise<StoreLike>;
  clearRegistry?: () => void;
}

const state: { runtime: MorselRuntime | undefined } = { runtime: undefined };

/**
 * Register the morsel runtime so that `setupTest` and other helpers can
 * call `loadConfig` / `createReactiveStore` without a direct dependency on
 * `@oclio/morsel`. Called once in the e2e setup file.
 *
 * @param runtime - The runtime facade to register.
 */
export function registerMorselRuntime(runtime: MorselRuntime): void {
  state.runtime = runtime;
}

/**
 * Retrieve the previously registered morsel runtime.
 *
 * @returns The registered `MorselRuntime`.
 * @throws If no runtime has been registered yet.
 */
export function getMorselRuntime(): MorselRuntime {
  if (!state.runtime) {
    throw new Error(
      'Morsel test runtime not registered. Call registerMorselRuntime(...) before running tests.',
    );
  }
  return state.runtime;
}
