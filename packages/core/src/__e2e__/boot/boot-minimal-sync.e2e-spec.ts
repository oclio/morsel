import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { clearWatcherRegistry } from '@oclio/morsel-e2e-helpers';

import { loadConfigSync } from '@/index';

describe('boot-minimal-sync — loadConfigSync resolves $env in defaults', () => {
  clearWatcherRegistry();

  it('defaults: $env resolved per envName, extends stripped, via sync API', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'morsel-e2e-'));

    const { config, layers } = loadConfigSync({
      name: 'myapp',
      cwd: directory,
      envName: 'production',
      defaults: {
        port: 3000,
        nested: { a: 1, b: 2 },
        $env: {
          production: { port: 9000, nested: { b: 20 } },
          development: { port: 4000 },
        },
        extends: './should-be-stripped.json',
      },
    });

    expect(config).toEqual({ port: 9000, nested: { a: 1, b: 20 } });

    const [defaultsLayer] = layers;

    expect(defaultsLayer!.source).toBe('defaults');
    expect(defaultsLayer!.exists).toBe(true);
    expect(defaultsLayer!.config).toEqual({
      port: 9000,
      nested: { a: 1, b: 20 },
    });
    expect(defaultsLayer!.config).not.toHaveProperty('$env');
    expect(defaultsLayer!.config).not.toHaveProperty('extends');
  });
});
