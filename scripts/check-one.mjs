#!/usr/bin/env node

/**
 * check-one — run all checks on a single source file in one command.
 *
 * Chains type-check, lint, tests + coverage, and formatting on a src/ file
 * and its associated spec. Designed for fast feedback during development.
 *
 * Usage:
 *   pnpm check:one <path>
 *   pnpm check:one core/ignore/ignore-parser
 *   pnpm check:one src/core/ignore/ignore-parser.ts
 *
 * The path is resolved relative to src/. The spec is expected in
 * __tests__/ next to the file.
 *
 * Exit code: 0 if all checks pass, otherwise the exit code of the first failing tool.
 */

import { spawnSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import path from 'node:path';

const SOURCE_ROOT = 'src';

// ANSI color codes for the checkmark / crossmark (zero dependencies).
const GREEN = '\u{1B}[32m';
const RED = '\u{1B}[31m';
const RESET = '\u{1B}[0m';

// --- Utils ----------------------------------------------------------------

/**
 * Resolve a binary name to its full path by searching $PATH.
 */
function resolveBin(name) {
  for (const directory of process.env.PATH.split(path.delimiter)) {
    if (!directory) continue;

    const candidate = path.join(directory, name);

    try {
      accessSync(candidate, constants.X_OK);

      return candidate;
    } catch {
      // not executable or not found, try next directory
    }
  }

  return name;
}

const PNPM = resolveBin('pnpm');

/**
 * Resolve a user-provided input into sourcePath and testPath.
 */
function resolvePaths(input) {
  const clean = input.replace(/^\.?\/?/, '').replace(/\.ts$/, '');

  const hasSource = clean.startsWith(`${SOURCE_ROOT}/`);

  const base = hasSource ? clean : `${SOURCE_ROOT}/${clean}`;
  const sourcePath = `${base}.ts`;
  const testPath = `${base.replace(/\/([^/]+)$/, '/__tests__/$1')}.spec.ts`;

  return { sourcePath, testPath };
}

/**
 * Run a command and print a colored checkmark with the label.
 */
function run(label, command, arguments_, options = {}) {
  const result = spawnSync(command, arguments_, {
    stdio: 'pipe',
    encoding: 'utf8',
  });

  let displayLabel = label;

  // On success with coverage parsing, inject coverage summary into the label.
  if (options.coverage && result.status === 0) {
    const coverage = parseCoverage(result.stdout);
    if (coverage) {
      displayLabel = `${label} — Stmts: ${coverage.stmts} | Branch: ${coverage.branch} | Funcs: ${coverage.funcs} | Uncovered: ${coverage.uncovered || 'none'}`;
    }
  }

  const mark = result.status === 0 ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
  console.log(`${mark} ${displayLabel}`);

  // On failure, dump full output for debugging.
  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }

  // On success, optionally print stdout (unless silent).
  if (result.stdout && !options.silent) {
    process.stdout.write(result.stdout);
  }
}

/**
 * Parse the vitest coverage table and extract the "All files" row.
 */
function parseCoverage(stdout) {
  const lines = stdout.split('\n');
  for (const line of lines) {
    if (!line.trimStart().startsWith('All files')) {
      continue;
    }

    const cols = line.split('|').map((c) => c.trim());
    if (cols.length >= 6) {
      return {
        stmts: cols[1],
        branch: cols[2],
        funcs: cols[3],
        uncovered: cols[5] || '',
      };
    }
  }
}

// --- Main -----------------------------------------------------------------

async function main() {
  const input = process.argv
    .slice(2)
    .find((argument) => !argument.startsWith('-'));

  if (!input) {
    console.error('Usage: pnpm check:one <path>');
    console.error('Example: pnpm check:one core/ignore/ignore-parser');

    process.exit(1);
  }

  const { sourcePath, testPath } = resolvePaths(input);

  console.log(`Checking ${sourcePath}`);

  run('Type checking', PNPM, ['tsc', '--noEmit']);
  run('Linting', PNPM, ['eslint', '--fix', sourcePath, testPath]);
  run(
    'Tests + coverage',
    PNPM,
    [
      'vitest',
      'run',
      '--coverage',
      `--coverage.include=${sourcePath}`,
      '--reporter=dot',
      testPath,
    ],
    { coverage: true, silent: true },
  );
  run('Formatting', PNPM, ['prettier', '--write', sourcePath, testPath], {
    silent: true,
  });

  console.log(`${GREEN}✓${RESET} All checks passed`);
}

try {
  await main();
} catch (error) {
  console.error(error);

  process.exit(1);
}
