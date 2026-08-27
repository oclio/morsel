import { clearWatcherRegistry, setupTest } from '@oclio/morsel-test-helpers';

describe('env-merge-values — $env override value types', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('$env override with null value — null overwrites via deepMerge', async () => {
    const { result } = await setupTest({
      projectConfig: { port: 3000, $env: { ci: { port: null } } },
      envName: 'ci',
    });

    expect(result!.config).toEqual({ port: null });
  });

  it('$env override with undefined value — undefined ignored, original preserved', async () => {
    const { result } = await setupTest({
      projectConfig: { port: 3000, $env: { ci: { port: undefined } } },
      envName: 'ci',
    });

    expect(result!.config).toEqual({ port: 3000 });
  });

  it('$env override with array value — array replaces per arrayMerge strategy', async () => {
    const { result } = await setupTest({
      projectConfig: { tags: ['a', 'b'], $env: { ci: { tags: ['x'] } } },
      envName: 'ci',
    });

    expect(result!.config).toEqual({ tags: ['x'] });
  });
});
