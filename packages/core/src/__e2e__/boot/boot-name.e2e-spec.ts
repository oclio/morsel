import { clearWatcherRegistry } from '@oclio/morsel-e2e-helpers';

import { loadConfig } from '@/index';

describe('boot-name — assertName validation', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('throws TypeError when name is not provided', async () => {
    await expect(
      loadConfig({
        // @ts-expect-error — intentionally missing name
        name: undefined,
      }),
    ).rejects.toThrow(TypeError);
  });

  it('throws TypeError when name is empty string', async () => {
    await expect(loadConfig({ name: '' })).rejects.toThrow(TypeError);
  });

  it.each([42, true, {}, null])(
    'throws TypeError when name is %s (non-string)',
    async (value) => {
      await expect(
        loadConfig({
          // @ts-expect-error — intentionally non-string name
          name: value,
        }),
      ).rejects.toThrow(TypeError);
    },
  );

  it('throws TypeError when name starts with a digit', async () => {
    await expect(loadConfig({ name: '1app' })).rejects.toThrow(TypeError);
  });

  it('throws TypeError when name contains special characters', async () => {
    await expect(loadConfig({ name: 'my app!' })).rejects.toThrow(TypeError);
  });

  it.each(['my-app', 'my_app', 'app123', 'a', 'A-B_C'])(
    'accepts valid name "%s"',
    async (name) => {
      const { config } = await loadConfig({
        name,
        cwd: '/nonexistent',
        globalDir: '/nonexistent',
      });

      expect(config).toEqual({});
    },
  );
});
