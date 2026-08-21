import { clearWatcherRegistry } from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('boot-name-missing — name absent', () => {
  clearWatcherRegistry();

  it('throws TypeError when name is not provided', async () => {
    await expect(
      loadConfig({
        // @ts-expect-error — intentionally missing name
        name: undefined,
      }),
    ).rejects.toThrow(TypeError);
  });
});
