import { clearWatcherRegistry, setupTest } from '@oclio/test-helpers';

describe('read-ops-security — prototype protection', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it.each(['__proto__', 'constructor', 'prototype'])(
    'get with %s string path throws TypeError',
    async (unsafeKey) => {
      const { store } = await setupTest({
        defaults: { port: 3000 },
        createGlobalDir: true,
      });

      expect(() => store!.get(unsafeKey)).toThrow(TypeError);

      await store!.stop();
    },
  );

  it.each(['__proto__', 'constructor'])(
    'has with %s string path throws TypeError',
    async (unsafeKey) => {
      const { store } = await setupTest({
        defaults: { port: 3000 },
        createGlobalDir: true,
      });

      expect(() => store!.has(unsafeKey)).toThrow(TypeError);

      await store!.stop();
    },
  );

  it('get with array path containing __proto__ throws TypeError (spec: any access rejected)', async () => {
    const { store } = await setupTest({
      defaults: { port: 3000 },
      createGlobalDir: true,
    });

    expect(() => store!.get(['__proto__'])).toThrow(TypeError);

    await store!.stop();
  });
});
