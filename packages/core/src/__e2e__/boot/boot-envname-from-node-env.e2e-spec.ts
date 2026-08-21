import { clearWatcherRegistry, setupTest } from '@oclio/morsel-e2e-helpers';

describe('boot-envname-from-node-env — envName defaults to NODE_ENV', () => {
  clearWatcherRegistry();

  it('applies $env block matching process.env.NODE_ENV', async () => {
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
      });

      expect(result!.config).toEqual({ port: 8080 });
    } finally {
      if (previousNodeEnvironment === undefined) {
        delete process.env['NODE_ENV'];
      } else {
        process.env['NODE_ENV'] = previousNodeEnvironment;
      }
    }
  });
});
