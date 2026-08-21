import path from 'node:path';

import { jsonPlugin, resolvePaths } from '@/index';

describe('resolve-paths-custom-global-dir — explicit globalDir', () => {
  it('global path resolves within custom globalDir', () => {
    const result = resolvePaths(
      { name: 'myapp', globalDir: '/custom/global' },
      [jsonPlugin],
    );

    expect(result.global).toBe(
      path.resolve('/custom/global', 'myapp.config.json'),
    );
  });
});
