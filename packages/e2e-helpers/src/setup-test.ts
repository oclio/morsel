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
  hooks?: readonly {
    readonly name: string;
    readonly lifecycle: string;
    load(context: unknown): ConfigRecord | Promise<ConfigRecord>;
  }[];
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
  ): () => void;
  stop(): Promise<void>;
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
    const store = await runtime.watchConfig(watchOptions);
    return { directory, projectDirectory, globalDirectory, store };
  }

  const result = await runtime.loadConfig(configOptions);
  return { directory, projectDirectory, globalDirectory, result };
}
