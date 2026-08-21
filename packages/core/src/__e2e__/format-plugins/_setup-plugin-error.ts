import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

export interface PluginErrorScenario {
  readonly directory: string;
  readonly projectDirectory: string;
}

/**
 * Boot a project config that extends a base file with an unsupported
 * extension. The store is not created — callers run `loadConfig` and
 * assert the ENOPLUGIN rejection themselves.
 */
export async function setupPluginErrorScenario(
  baseFile: string,
  content: string,
): Promise<PluginErrorScenario> {
  const { directory } = await createTemporaryEnvironment();
  const projectDirectory = `${directory}/project`;

  await mkdir(projectDirectory, { recursive: true });
  await writeFile(path.resolve(projectDirectory, baseFile), content, 'utf8');
  await writeConfig(projectDirectory, 'myapp.config.json', {
    extends: `./${baseFile}`,
  });

  return { directory, projectDirectory };
}
