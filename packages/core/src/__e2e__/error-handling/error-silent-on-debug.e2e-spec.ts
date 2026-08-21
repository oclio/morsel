import { writeFile } from 'node:fs/promises';

import { clearWatcherRegistry, setupTest } from '@oclio/morsel-e2e-helpers';
import { vi } from 'vitest';

describe('error-silent-on-debug — onDebug: () => {} → total silence', () => {
  clearWatcherRegistry();

  it('re-merge failure with empty onDebug → no stderr, config kept', async () => {
    const { store, projectDirectory } = await setupTest({
      watch: true,
      projectConfig: { port: 3000 },
      createGlobalDir: true,
      onDebug: () => {},
    });

    const stderrSpy = vi.spyOn(console, 'error');

    await writeFile(
      `${projectDirectory}/myapp.config.json`,
      '{ broken',
      'utf8',
    );

    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(store!.config).toEqual({ port: 3000 });
    expect(stderrSpy).not.toHaveBeenCalled();

    stderrSpy.mockRestore();
    await store!.stop();
  });
});
