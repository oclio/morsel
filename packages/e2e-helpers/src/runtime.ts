type ConfigRecord = Record<string, unknown>;
export type RuntimeOptions = ConfigRecord & { readonly name: string };

export interface MinimalLayer {
  readonly source: string;
  readonly path: string | undefined;
  readonly config: ConfigRecord;
  readonly exists: boolean;
  readonly extendsPaths: readonly string[];
  readonly hookName?: string;
}

export interface ConfigResultLike {
  readonly config: ConfigRecord;
  readonly layers: readonly MinimalLayer[];
}

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

export interface MorselRuntime {
  loadConfig: (options: RuntimeOptions) => Promise<ConfigResultLike>;
  loadConfigSync?: (options: RuntimeOptions) => ConfigResultLike;
  watchConfig: (options: RuntimeOptions) => Promise<StoreLike>;
  clearRegistry?: () => void;
}

const state: { runtime: MorselRuntime | undefined } = { runtime: undefined };

export function registerMorselRuntime(runtime: MorselRuntime): void {
  state.runtime = runtime;
}

export function getMorselRuntime(): MorselRuntime {
  if (!state.runtime) {
    throw new Error(
      'Morsel test runtime not registered. Call registerMorselRuntime(...) before running tests.',
    );
  }
  return state.runtime;
}
