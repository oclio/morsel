import { mkdir } from 'node:fs/promises';

import {
  getMorselRuntime,
  type MinimalLayer,
  type RuntimeOptions,
} from './runtime';
import { createTemporaryEnvironment } from './temporary-env';
import { writeConfig } from './write-config';

type ConfigRecord = Record<string, unknown>;

export interface SetupTestOptions {
  name?: string;
  cwd?: string;
  defaults?: ConfigRecord;
  overrides?: ConfigRecord;
  projectConfig?: ConfigRecord;
  projectFilename?: string;
  globalConfig?: ConfigRecord;
  globalFilename?: string;
  createGlobalDir?: boolean;
  watch?: boolean;
  watchDebounce?: number;
  rootAsCwd?: boolean;
  skipGlobalDirectory?: boolean;
  formatPlugins?: readonly {
    readonly name: string;
    readonly extensions: readonly string[];
    parse(content: string, filePath?: string): ConfigRecord;
  }[];
  validationPlugins?: readonly {
    readonly name: string;
    validate(config: ConfigRecord): ConfigRecord;
  }[];
  hooks?: readonly (
    | {
        readonly name: string;
        readonly lifecycle: string;
        load(context: unknown): ConfigRecord | Promise<ConfigRecord>;
        init?(context: unknown): void | Promise<void>;
        dispose?(): void | Promise<void>;
      }
    | {
        readonly name: string;
        readonly lifecycle: string;
        load(context: unknown): ConfigRecord | Promise<ConfigRecord>;
        readonly watchPaths: readonly string[];
        init?(context: unknown): void | Promise<void>;
        dispose?(): void | Promise<void>;
      }
    | {
        readonly name: string;
        readonly lifecycle: 'after:write';
        onWrite(event: unknown): void | Promise<void>;
      }
  )[];
  arrayMerge?: 'replace' | 'concat';
  configMutability?: 'frozen' | 'mutable';
  envName?: string;
  verbose?: boolean;
  onDebug?: (message: string, context?: Record<string, unknown>) => void;
  [key: string]: unknown;
}

export interface MinimalStore {
  readonly config: Record<string, unknown>;
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
  get<V = unknown>(
    path: string | readonly (string | number)[],
    defaultValue?: V,
  ): V;
  has(path: string | readonly (string | number)[]): boolean;
  set(
    path: string | readonly (string | number)[],
    value: unknown,
    target?: unknown,
  ): Promise<void>;
  unset(
    path: string | readonly (string | number)[],
    target?: unknown,
  ): Promise<boolean>;
  all(): Record<string, unknown>;
  dotify(): Record<string, unknown>;
  mutateKey(
    path: string | readonly (string | number)[],
    value: unknown,
    target?: unknown,
  ): Promise<void>;
  deleteKey(
    path: string | readonly (string | number)[],
    target?: unknown,
  ): Promise<boolean>;
  push(
    path: string | readonly (string | number)[],
    value: unknown,
    target?: unknown,
  ): Promise<number>;
  unshift(
    path: string | readonly (string | number)[],
    value: unknown,
    target?: unknown,
  ): Promise<number>;
  pop(
    path: string | readonly (string | number)[],
    target?: unknown,
  ): Promise<unknown>;
  shift(
    path: string | readonly (string | number)[],
    target?: unknown,
  ): Promise<unknown>;
  splice(
    path: string | readonly (string | number)[],
    start: number,
    deleteCount: number,
    ...items: unknown[]
  ): Promise<unknown[]>;
  indexOf(path: string | readonly (string | number)[], value: unknown): number;
  lastIndexOf(
    path: string | readonly (string | number)[],
    value: unknown,
  ): number;
  stop(): Promise<void>;
  getProvenance(path: string | readonly (string | number)[]): unknown;
  transaction(callback: () => Promise<void>): Promise<void>;
}

export interface MinimalConfigResult {
  readonly config: Record<string, unknown>;
  readonly layers: readonly MinimalLayer[];
}

export interface SetupTestResult<
  TStore = MinimalStore,
  TResult = MinimalConfigResult,
> {
  directory: string;
  projectDirectory: string;
  globalDirectory: string;
  store?: TStore;
  result?: TResult;
}

/**
 * Setup a complete e2e test environment with optional project/global configs.
 * Creates a temp directory with `project/` and `global/` subdirectories.
 * If `watch` is true, returns a `store` from `watchConfig`.
 * Otherwise, returns a `result` from `loadConfig`.
 */
export async function setupTest(
  options: SetupTestOptions = {},
): Promise<SetupTestResult> {
  const {
    name = 'myapp',
    projectConfig,
    projectFilename = 'myapp.config.json',
    globalConfig,
    globalFilename = 'myapp.config.json',
    createGlobalDir,
    watch = false,
    watchDebounce,
    rootAsCwd = false,
    skipGlobalDirectory = false,
    ...rest
  } = options;

  const { directory } = await createTemporaryEnvironment();
  const projectDirectory = rootAsCwd ? directory : `${directory}/project`;
  const globalDirectory = `${directory}/global`;

  const shouldCreateGlobalDirectory =
    createGlobalDir ?? globalConfig !== undefined;
  if (shouldCreateGlobalDirectory) {
    await mkdir(globalDirectory, { recursive: true });
  }

  if (globalConfig) {
    await writeConfig(globalDirectory, globalFilename, globalConfig);
  }

  if (projectConfig || watch) {
    await mkdir(projectDirectory, { recursive: true });
  }

  if (projectConfig) {
    await writeConfig(projectDirectory, projectFilename, projectConfig);
  }

  const configOptions: RuntimeOptions = {
    name,
    cwd: projectDirectory,
    ...(!skipGlobalDirectory && { globalDir: globalDirectory }),
    ...rest,
  };

  const runtime = getMorselRuntime();

  if (watch) {
    const watchOptions: RuntimeOptions =
      watchDebounce === undefined
        ? configOptions
        : { ...configOptions, watchDebounce };
    const store = (await runtime.watchConfig(watchOptions)) as MinimalStore;
    return { directory, projectDirectory, globalDirectory, store };
  }

  const result = await runtime.loadConfig(configOptions);
  return { directory, projectDirectory, globalDirectory, result };
}
