import { clearWatcherRegistry } from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('boot-name-invalid — non-alphanumeric name', () => {
  clearWatcherRegistry();

  it('throws TypeError when name contains special characters', async () => {
    await expect(
      loadConfig({
        name: 'my app!',
      }),
    ).rejects.toThrow(TypeError);
  });
});
