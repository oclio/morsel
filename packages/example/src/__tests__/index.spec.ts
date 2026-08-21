import { main } from '@/index';

describe('main', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs "example" to the console', () => {
    const spy = vi.spyOn(console, 'log');
    main();
    expect(spy).toHaveBeenCalledWith('example');
  });
});
