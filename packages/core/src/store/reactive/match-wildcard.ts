/**
 * Check if a dotted key path matches a wildcard pattern.
 *
 * - `*` matches exactly one segment (e.g. `foo.*` matches `foo.bar` but not
 *   `foo.bar.baz`).
 * - `**` matches zero or more segments (e.g. `foo.**` matches `foo`,
 *   `foo.bar`, `foo.bar.baz`).
 * - A bare `**` matches any key.
 *
 * @param pattern - The wildcard pattern (dotted path with `*` / `**`).
 * @param key - The dotted key path to test.
 * @returns `true` if the key matches the pattern.
 */
export function isWildcardMatch(pattern: string, key: string): boolean {
  const patternParts = pattern.split('.');
  const keyParts = key.split('.');
  let pi = 0;
  let ki = 0;
  let starPi = -1;
  let starKi = 0;

  while (ki < keyParts.length) {
    if (patternParts[pi] === '**') {
      starPi = pi;
      starKi = ki;
      pi++;
    } else if (patternParts[pi] === '*' || patternParts[pi] === keyParts[ki]) {
      pi++;
      ki++;
    } else if (starPi === -1) {
      return false;
    } else {
      pi = starPi + 1;
      starKi++;
      ki = starKi;
    }
  }

  while (patternParts[pi] === '**') {
    pi++;
  }

  return pi === patternParts.length;
}

/**
 * Check if a pattern contains any wildcard characters.
 */
export function isWildcardPattern(pattern: string): boolean {
  return pattern.includes('*');
}
