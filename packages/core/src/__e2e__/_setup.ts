import { registerMorselRuntime } from '@oclio/morsel-test-helpers';

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
