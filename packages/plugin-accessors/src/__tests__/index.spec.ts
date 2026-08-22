import { describe, expect, it, vi } from 'vitest';

import { main } from '../index';

describe('main', () => {
  it('logs the plugin name to console', () => {
    const spy = vi.spyOn(console, 'log');
    main();
    expect(spy).toHaveBeenCalledWith('accessors-plugin');
    spy.mockRestore();
  });
});
