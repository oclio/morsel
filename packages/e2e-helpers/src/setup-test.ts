import { mkdir } from 'node:fs/promises';

import {
  type ConfigResult,
  loadConfig,
  type MorselOptions,
  type MorselStore,
  watchConfig,
} from '@oclio/morsel';

import { createTemporaryEnvironment } from './temporary-env';
import { writeConfig } from './write-config';

type ConfigRecord = Record<string, unknown>;

export interface SetupTestOptions extends Omit<
  MorselOptions,
  'name' | 'cwd' | 'globalDir'
> {
  name?: string;
  projectConfig?: ConfigRecord;
  projectFilename?: string;
  globalConfig?: ConfigRecord;
  globalFilename?: string;
  createGlobalDir?: boolean;
  watch?: boolean;
  watchDebounce?: number;
  rootAsCwd?: boolean;
  skipGlobalDirectory?: boolean;
}

export interface SetupTestResult {
  directory: string;
  projectDirectory: string;
  globalDirectory: string;
  store?: MorselStore;
  result?: ConfigResult;
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

  const configOptions: MorselOptions = {
    name,
    cwd: projectDirectory,
    ...(!skipGlobalDirectory && { globalDir: globalDirectory }),
    ...rest,
  };

  if (watch) {
    const store = await watchConfig(
      watchDebounce === undefined
        ? configOptions
        : { ...configOptions, watchDebounce },
    );
    return { directory, projectDirectory, globalDirectory, store };
  }

  const result = await loadConfig(configOptions);
  return { directory, projectDirectory, globalDirectory, result };
}
