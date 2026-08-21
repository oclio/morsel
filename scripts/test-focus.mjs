#!/usr/bin/env node

/**
 * test-focus — run Stryker mutation testing on a single source file.
 *
 * Chains vitest coverage, Stryker incremental mutation testing, and extracts
 * surviving mutants into ./mutants.txt. Designed for fast, targeted mutation
 * analysis during development.
 *
 * Usage:
 *   pnpm test:focus <path>
 *   pnpm test:focus core/ignore/ignore-parser
 *   pnpm test:focus src/core/ignore/ignore-parser.ts
 *
 * The path is resolved relative to src/. The spec is expected in
 * __tests__/ next to the file.
 *
 * On each run, ./mutants.txt is overwritten with the list of surviving mutants
 * (if any). The file is cleared at startup and repopulated with the results.
 *
 * Exit code: 0 if mutation score meets the threshold, otherwise Stryker's exit code.
 */

import { spawnSync } from 'node:child_process';
import {
  accessSync,
  constants,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

const SOURCE_ROOT = 'src';
const MUTANTS_FILE = 'mutants.txt';
const REPORT_PATH = 'reports/mutation/mutation.json';

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

function resolvePaths(input) {
  const clean = input.replace(/^\.?\/?/, '').replace(/\.ts$/, '');

  const hasSource = clean.startsWith(`${SOURCE_ROOT}/`);

  const base = hasSource ? clean : `${SOURCE_ROOT}/${clean}`;
  const sourcePath = `${base}.ts`;
  const testPath = `${base.replace(/\/([^/]+)$/, '/__tests__/$1')}.spec.ts`;

  return { sourcePath, testPath };
}

async function main() {
  const arguments_ = process.argv.slice(2);
  const noMutate =
    arguments_.includes('-n') || arguments_.includes('--no-mutate');
  const input = arguments_.find((argument) => !argument.startsWith('-'));

  if (!input) {
    console.error('Usage: pnpm test:focus <path> [-n|--no-mutate]');
    console.error('Example: pnpm test:focus commands/index');
    console.error('         pnpm test:focus commands/index --no-mutate');

    process.exit(1);
  }

  const { sourcePath, testPath } = resolvePaths(input);

  writeFileSync(MUTANTS_FILE, '');

  const coverageResult = spawnSync(
    PNPM,
    [
      'vitest',
      'run',
      '--coverage',
      `--coverage.include=${sourcePath}`,
      '--reporter=dot',
      testPath,
    ],
    { stdio: 'inherit' },
  );

  if (coverageResult.status !== 0) {
    process.exit(coverageResult.status ?? 1);
  }

  if (!noMutate) {
    try {
      unlinkSync('.stryker-tmp/incremental.json');
    } catch {
      // file may not exist on first run, safe to ignore
    }

    const mutateResult = spawnSync(
      PNPM,
      ['stryker', 'run', '--mutate', sourcePath],
      { stdio: 'inherit' },
    );

    if (mutateResult.status !== 0) {
      process.exit(mutateResult.status ?? 1);
    }

    extractSurvivedMutants(sourcePath);
  }
}

function collectTestNames(report) {
  const testNames = new Map();

  for (const testFile of Object.values(report.testFiles)) {
    const tests = testFile.tests ?? [];

    for (const test of tests) {
      testNames.set(test.id, test.name);
    }
  }

  return testNames;
}

function buildMutationText(sourceLines, replacement, location) {
  const { start, end } = location;

  if (start.line === end.line) {
    const line = sourceLines[start.line - 1];

    return {
      original: line,
      mutated:
        line.slice(0, start.column - 1) +
        replacement +
        line.slice(end.column - 1),
    };
  }

  const original = sourceLines.slice(start.line - 1, end.line).join('\n');
  const firstLine = sourceLines[start.line - 1];
  const lastLine = sourceLines[end.line - 1];
  const mutated =
    firstLine.slice(0, start.column - 1) +
    replacement +
    lastLine.slice(end.column - 1);

  return { original, mutated };
}

function formatTestList(coveredBy, testNames) {
  if (!coveredBy?.length) return [];

  const names = coveredBy.map((id) => testNames.get(id)).filter(Boolean);
  const lines = ['Tests ran:'];

  for (const name of names.slice(0, 3)) {
    lines.push(`    ${name}`);
  }

  if (names.length > 3) {
    lines.push(`  and ${names.length - 3} more tests!`);
  }

  return lines;
}

function formatMutant(mutant, filePath, sourceLines, testNames) {
  const { mutatorName, replacement, location, coveredBy } = mutant;
  const { original, mutated } = buildMutationText(
    sourceLines,
    replacement,
    location,
  );

  const lines = [
    `[Survived] ${mutatorName}`,
    `${filePath}:${location.start.line}:${location.start.column}`,
  ];

  for (const originalLine of original.split('\n')) {
    lines.push(`-     ${originalLine}`);
  }

  lines.push(`+     ${mutated}`, ...formatTestList(coveredBy, testNames));

  return lines.join('\n');
}

function extractSurvivedMutants(sourcePath) {
  const report = JSON.parse(readFileSync(REPORT_PATH, 'utf8'));
  const testNames = collectTestNames(report);
  const blocks = [];

  for (const [filePath, fileData] of Object.entries(report.files)) {
    if (filePath !== sourcePath) continue;
    const sourceLines = readFileSync(filePath, 'utf8').split('\n');
    const mutants = fileData.mutants ?? [];
    const survived = mutants.filter((mutant) => mutant.status === 'Survived');

    for (const mutant of survived) {
      blocks.push(formatMutant(mutant, filePath, sourceLines, testNames));
    }
  }

  writeFileSync(
    MUTANTS_FILE,
    blocks.join('\n\n') + (blocks.length > 0 ? '\n' : ''),
  );
}

try {
  await main();
} catch (error) {
  console.error(error);

  process.exit(1);
}
