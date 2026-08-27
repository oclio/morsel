import { clearWatcherRegistry, setupTest } from '@oclio/test-helpers';

describe('cascade-arrays — array merge strategies', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('concat with missing layer — defaults has no tags, project has tags', async () => {
    const { result } = await setupTest({
      projectConfig: { tags: ['c'] },
      arrayMerge: 'concat',
    });

    const { config } = result!;

    expect(config).toEqual({ tags: ['c'] });
  });

  it('concat with empty array — defaults tags:[], project tags:[c]', async () => {
    const { result } = await setupTest({
      projectConfig: { tags: ['c'] },
      defaults: { tags: [] },
      arrayMerge: 'concat',
    });

    const { config } = result!;

    expect(config).toEqual({ tags: ['c'] });
  });

  it('replace with empty array — defaults tags:[a,b], project tags:[]', async () => {
    const { result } = await setupTest({
      projectConfig: { tags: [] },
      defaults: { tags: ['a', 'b'] },
    });

    const { config } = result!;

    expect(config).toEqual({ tags: [] });
  });

  it('array of objects with concat — objects cloned, not shared by reference', async () => {
    const { result } = await setupTest({
      globalConfig: { tags: [{ a: 1 }] },
      projectConfig: { tags: [{ b: 2 }] },
      arrayMerge: 'concat',
    });

    const { config } = result!;

    expect(config['tags']).toEqual([{ a: 1 }, { b: 2 }]);

    const tags = config['tags'] as Record<string, unknown>[];
    expect(tags[0]).not.toBe(tags[1]);
    expect(tags[0]).toEqual({ a: 1 });
    expect(tags[1]).toEqual({ b: 2 });
  });

  it('array of objects with replace — objects cloned', async () => {
    const { result } = await setupTest({
      globalConfig: { tags: [{ a: 1 }] },
      projectConfig: { tags: [{ b: 2 }] },
    });

    const { config } = result!;

    expect(config['tags']).toEqual([{ b: 2 }]);

    const tags = config['tags'] as Record<string, unknown>[];
    expect(tags[0]).toEqual({ b: 2 });
  });

  it('array nested in object — array merge applies recursively', async () => {
    const { result } = await setupTest({
      globalConfig: { features: { tags: ['a'] } },
      projectConfig: { features: { tags: ['b'] } },
      arrayMerge: 'concat',
    });

    const { config } = result!;

    expect(config).toEqual({
      features: { tags: ['a', 'b'] },
    });
  });

  it('array of arrays — outer array merged per strategy', async () => {
    const { result } = await setupTest({
      globalConfig: { matrix: [[1, 2]] },
      projectConfig: { matrix: [[3, 4]] },
      arrayMerge: 'concat',
    });

    const { config } = result!;

    expect(config).toEqual({
      matrix: [
        [1, 2],
        [3, 4],
      ],
    });
  });
});
