import { registerMorselRuntime } from '@oclio/morsel-e2e-helpers';

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
