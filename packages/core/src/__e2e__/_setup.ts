import { registerMorselRuntime } from '@oclio/test-helpers';

import {
  clearRegistry,
  loadConfig,
  loadConfigSync,
  watchConfig,
} from '@/index';

registerMorselRuntime({
  loadConfig,
  loadConfigSync,
  watchConfig,
  clearRegistry,
});
