/**
 * Prototype pollution keys forbidden across all path operations.
 */
const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * A single segment of a normalized path — either a string key or a numeric array index.
 */
export type PathSegment = string | number;

/**
 * Validate path segments against prototype pollution and illegal types.
 *
 * @param segments - Normalized path segments to validate.
 * @throws TypeError If a forbidden segment is found.
 */
export function validatePath(segments: readonly PathSegment[]): void {
  for (const segment of segments) {
    if (FORBIDDEN_SEGMENTS.has(segment as string)) {
      throw new TypeError(
        `morsel: prototype pollution attempt detected: "${segment}"`,
      );
    }
  }
}

function parseToken(token: string): PathSegment {
  const asNumber = Number(token);
  if (
    Number.isSafeInteger(asNumber) &&
    asNumber >= 0 &&
    String(asNumber) === token
  ) {
    return asNumber;
  }
  return token;
}

function normalizeArrayPath(path: readonly PathSegment[]): PathSegment[] {
  const normalized: PathSegment[] = Array.from(path, (segment) =>
    parseToken(segment as string),
  );
  return normalized;
}

/**
 * State container used while parsing string path expressions.
 */
interface ParserState {
  current: string;
  inBracket: boolean;
  isEscaped: boolean;
  readonly segments: PathSegment[];
}

function flushToken(state: ParserState): void {
  if (state.current.length === 0) {
    return;
  }

  state.segments.push(parseToken(state.current));
  state.current = '';
}

function handleChar(char: string, state: ParserState): void {
  if (state.isEscaped) {
    state.current += char;
    state.isEscaped = false;
    return;
  }

  if (char === '\\') {
    state.isEscaped = true;
    return;
  }

  if (char === '[' && !state.inBracket) {
    flushToken(state);
    state.inBracket = true;
    return;
  }

  if (char === ']' && state.inBracket) {
    state.inBracket = false;
    flushToken(state);
    return;
  }

  if (char === '.' && !state.inBracket) {
    flushToken(state);
    return;
  }

  state.current += char;
}

function parseStringPath(path: string): PathSegment[] {
  const state: ParserState = {
    current: '',
    inBracket: false,
    isEscaped: false,
    segments: [],
  };

  for (const char of path) {
    handleChar(char, state);
  }

  flushToken(state);
  return state.segments;
}

/**
 * Parse a dot or bracket path string or segment array into normalized path segments.
 *
 * @param path - The path string or segment array.
 * @returns Array of string or number segments.
 */
export function parsePath(
  path: string | readonly PathSegment[],
): PathSegment[] {
  const segments = Array.isArray(path)
    ? normalizeArrayPath(path)
    : parseStringPath(path as string);

  validatePath(segments);
  return segments;
}
