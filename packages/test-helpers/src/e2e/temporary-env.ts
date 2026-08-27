import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
Return value of {@link createTemporaryEnvironment}.
*/
export interface TemporaryEnvironment {
  readonly directory: string;
  readonly cleanup: () => Promise<void>;
}

/**
 * Create an isolated tmpdir for an e2e test.
 * Cleanup is automatic via `afterEach`.
 */
export async function createTemporaryEnvironment(
  prefix = 'morsel-e2e-',
): Promise<TemporaryEnvironment> {
  const directory = await mkdtemp(path.join(tmpdir(), prefix));

  let isCleaned = false;
  const cleanup = async (): Promise<void> => {
    if (isCleaned) return;
    isCleaned = true;
    await rm(directory, { recursive: true, force: true });
  };

  if (typeof afterEach === 'function') {
    afterEach(cleanup);
  }

  return { directory, cleanup };
}
