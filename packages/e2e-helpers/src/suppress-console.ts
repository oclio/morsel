const noop = (): undefined => undefined;

/**
 * Suppress `console.error` for the duration of each test.
 *
 * Registers `beforeEach`/`afterEach` hooks that spy on `console.error`
 * and restore all mocks after each test. Call once at the top of a
 * `describe` block — no need to call inside `beforeEach`.
 */
export function suppressConsoleError(): void {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(noop);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });
}
