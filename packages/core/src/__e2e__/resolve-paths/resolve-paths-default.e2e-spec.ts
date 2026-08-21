import { homedir } from 'node:os';
import path from 'node:path';

import { jsonPlugin, resolvePaths } from '@/index';

describe('resolve-paths-default — default jsonPlugin extension', () => {
  it('returns .json paths for global and project', () => {
    const result = resolvePaths({ name: 'myapp' }, [jsonPlugin]);

    expect(result.project).toBe(
      path.resolve(process.cwd(), 'myapp.config.json'),
    );
    expect(result.global).toBe(
      path.resolve(homedir(), '.config', 'myapp', 'myapp.config.json'),
    );
  });
});
