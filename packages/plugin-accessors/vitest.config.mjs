import baseConfig from '@config/vitest/base';
import { mergeConfig } from 'vitest/config';

export default mergeConfig(baseConfig, {
  test: {
    coverage: {
      exclude: ['src/index.ts'],
    },
  },
});
