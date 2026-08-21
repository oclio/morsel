import { clearWatcherRegistry, setupTest } from '@oclio/morsel-e2e-helpers';

describe('boot-envname-explicit — explicit envName overrides NODE_ENV', () => {
  clearWatcherRegistry();

  it('applies $env block matching explicit envName, not NODE_ENV', async () => {
    const previousNodeEnvironment = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'ci';

    try {
      const { result } = await setupTest({
        rootAsCwd: true,
        projectConfig: {
          port: 3000,
          $env: {
            ci: { port: 8080 },
            prod: { port: 9000 },
          },
        },
        envName: 'prod',
      });

      expect(result!.config).toEqual({ port: 9000 });
    } finally {
      if (previousNodeEnvironment === undefined) {
        delete process.env['NODE_ENV'];
      } else {
        process.env['NODE_ENV'] = previousNodeEnvironment;
      }
    }
  });
});
