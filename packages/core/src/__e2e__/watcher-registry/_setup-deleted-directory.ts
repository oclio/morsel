import { mkdir, rm } from 'node:fs/promises';

import {
  createTemporaryEnvironment,
  writeConfig,
} from '@oclio/morsel-e2e-helpers';

import { watchConfig } from '@/index';

export interface DeletedDirectoryScenario {
  readonly store: Awaited<ReturnType<typeof watchConfig>>;
  readonly projectDirectory: string;
}

/**
 * Boot a store on a project config (port 3000) with defaults
 * (port 4000), then delete the project directory and wait 1s
 * for the watcher to react. The store is left in the post-deletion
 * state — callers assert their own invariant.
 */
export async function setupDeletedDirectoryScenario(): Promise<DeletedDirectoryScenario> {
  const { directory } = await createTemporaryEnvironment();
  const projectDirectory = `${directory}/project`;

  await writeConfig(projectDirectory, 'myapp.config.json', { port: 3000 });
  await mkdir(`${directory}/global`, { recursive: true });

  const store = await watchConfig({
    name: 'myapp',
    cwd: projectDirectory,
    globalDir: `${directory}/global`,
    defaults: { port: 4000 },
    onDebug: () => {},
  });

  await rm(projectDirectory, { recursive: true, force: true });
  await new Promise((resolve) => setTimeout(resolve, 1000));

  return { store, projectDirectory };
}
