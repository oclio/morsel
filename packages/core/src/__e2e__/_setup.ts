import { registerMorselRuntime } from '@oclio/test-helpers';

import {
  clearRegistry,
  createReactiveStore,
  loadConfig,
  loadConfigSync,
} from '@/index';

registerMorselRuntime({
  loadConfig,
  loadConfigSync,
  createReactiveStore,
  clearRegistry,
});
