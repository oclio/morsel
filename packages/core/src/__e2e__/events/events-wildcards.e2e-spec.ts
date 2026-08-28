import {
  clearWatcherRegistry,
  setupTest,
  waitForRemerge,
  writeConfig,
} from '@oclio/test-helpers';

describe('events-wildcards — wildcard patterns', () => {
  beforeEach(() => {
    clearWatcherRegistry();
  });

  it('foo.* matches direct children only (one segment)', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { foo: { bar: 1, baz: { qux: 2 } } },
      createGlobalDir: true,
    });

    const fired: string[] = [];
    store!.on('foo.*', (event) => {
      fired.push(event.keyPath);
    });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      foo: { bar: 10, baz: { qux: 20 } },
    });
    await waitForRemerge(
      store!,
      (config) => (config['foo'] as Record<string, unknown>)['bar'] === 10,
    );

    expect(fired).toContain('foo.bar');
    expect(fired).not.toContain('foo.baz.qux');

    await store!.stop();
  });

  it('** matches any key at any depth', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { a: { b: { c: 1 } } },
      createGlobalDir: true,
    });

    const fired: string[] = [];
    store!.on('**', (event) => {
      fired.push(event.keyPath);
    });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      a: { b: { c: 2 } },
    });
    await waitForRemerge(
      store!,
      (config) =>
        (
          (config['a'] as Record<string, unknown>)['b'] as Record<
            string,
            unknown
          >
        )['c'] === 2,
    );

    expect(fired).toContain('a.b.c');

    await store!.stop();
  });

  it('foo.** matches foo and all descendants (zero or more segments)', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { foo: { bar: 1, baz: { qux: 2 } } },
      createGlobalDir: true,
    });

    const fired: string[] = [];
    store!.on('foo.**', (event) => {
      fired.push(event.keyPath);
    });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      foo: { bar: 10, baz: { qux: 20 } },
    });
    await waitForRemerge(
      store!,
      (config) => (config['foo'] as Record<string, unknown>)['bar'] === 10,
    );

    expect(fired).toContain('foo.bar');
    expect(fired).toContain('foo.baz.qux');

    await store!.stop();
  });

  it('wildcard backtracking: a.**.b matches a.x.y.b', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { a: { x: { y: { b: 1 } } } },
      createGlobalDir: true,
    });

    const fired: string[] = [];
    store!.on('a.**.b', (event) => {
      fired.push(event.keyPath);
    });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      a: { x: { y: { b: 2 } } },
    });
    await waitForRemerge(
      store!,
      (config) =>
        (
          (
            (config['a'] as Record<string, unknown>)['x'] as Record<
              string,
              unknown
            >
          )['y'] as Record<string, unknown>
        )['b'] === 2,
    );

    expect(fired).toContain('a.x.y.b');

    await store!.stop();
  });

  it('wildcard listeners emitted after exact-match listeners', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { foo: { bar: 1 } },
      createGlobalDir: true,
    });

    const order: string[] = [];
    store!.on('foo.bar', () => {
      order.push('exact');
    });
    store!.on('foo.*', () => {
      order.push('wildcard');
    });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      foo: { bar: 2 },
    });
    await waitForRemerge(
      store!,
      (config) => (config['foo'] as Record<string, unknown>)['bar'] === 2,
    );

    expect(order).toEqual(['exact', 'wildcard']);

    await store!.stop();
  });

  it('wildcard listeners in insertion order', async () => {
    const { store, projectDirectory } = await setupTest({
      projectConfig: { foo: { bar: 1 } },
      createGlobalDir: true,
    });

    const order: string[] = [];
    store!.on('foo.*', () => {
      order.push('first');
    });
    store!.on('foo.*', () => {
      order.push('second');
    });
    store!.on('**', () => {
      order.push('third');
    });

    await writeConfig(projectDirectory, 'myapp.config.json', {
      foo: { bar: 2 },
    });
    await waitForRemerge(
      store!,
      (config) => (config['foo'] as Record<string, unknown>)['bar'] === 2,
    );

    expect(order).toEqual(['first', 'second', 'third']);

    await store!.stop();
  });
});
