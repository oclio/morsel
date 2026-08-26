import { createHookContext } from '@/hooks/hook-context';
import type { ResolvedOptions } from '@/store/boot/assert-name';

function makeOptions(
  overrides: Partial<ResolvedOptions> = {},
): ResolvedOptions {
  return {
    name: 'myapp',
    cwd: '/project',
    defaults: {},
    overrides: {},
    globalDir: '/global',
    arrayMerge: 'replace',
    envName: 'test',
    configMutability: 'frozen',
    verbose: false,
    onDebug: (): void => {},
    formatPlugins: [],
    validationPlugins: [],
    hooks: [],
    watch: true,
    proxy: true,
    queue: true,
    ...overrides,
  } as ResolvedOptions;
}

describe('createHookContext', () => {
  const noop = (): void => {};

  it('builds context with cwd and envName from resolved options', () => {
    const context = createHookContext(makeOptions(), noop);

    expect(context.cwd).toBe('/project');
    expect(context.envName).toBe('test');
  });

  it('preserves undefined envName when not set', () => {
    const context = createHookContext(
      makeOptions({ envName: undefined }),
      noop,
    );

    expect(context.envName).toBeUndefined();
  });

  it('uses custom cwd from options', () => {
    const context = createHookContext(
      makeOptions({ cwd: '/custom/path' }),
      noop,
    );

    expect(context.cwd).toBe('/custom/path');
  });

  it('creates a fresh context object each call', () => {
    const options = makeOptions();

    const context1 = createHookContext(options, noop);
    const context2 = createHookContext(options, noop);

    expect(context1).not.toBe(context2);
    expect(context1).toEqual(context2);
  });

  it('passes triggerRemerge into context', () => {
    const triggerRemerge = vi.fn();
    const context = createHookContext(makeOptions(), triggerRemerge);

    expect(context.triggerRemerge).toBe(triggerRemerge);
  });
});
