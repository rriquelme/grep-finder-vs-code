import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRgArgs } from '../src/search/args';
import type { SearchOptions } from '../src/models';

function opts(overrides: Partial<SearchOptions> = {}): SearchOptions {
  return {
    query: 'foo',
    isRegex: false,
    caseSensitive: false,
    wholeWord: false,
    contextAfter: 0,
    contextBefore: 0,
    contextBoth: 0,
    includeGlobs: [],
    excludeGlobs: [],
    ...overrides,
  };
}

test('fixed string by default, case-insensitive when match-case is off', () => {
  const args = buildRgArgs(opts());
  assert.deepEqual(args, ['--json', '--fixed-strings', '--ignore-case', '--', 'foo']);
});

test('an uppercase query stays case-insensitive when match-case is off', () => {
  // Regression: smart-case used to flip uppercase queries to case-sensitive.
  const args = buildRgArgs(opts({ query: 'Update' }));
  assert.ok(args.includes('--ignore-case'));
  assert.ok(!args.includes('--case-sensitive'));
  assert.ok(!args.includes('--smart-case'));
});

test('regex disables fixed-strings', () => {
  const args = buildRgArgs(opts({ isRegex: true }));
  assert.ok(!args.includes('--fixed-strings'));
});

test('match case on uses --case-sensitive', () => {
  const args = buildRgArgs(opts({ caseSensitive: true }));
  assert.ok(args.includes('--case-sensitive'));
  assert.ok(!args.includes('--ignore-case'));
});

test('whole word adds --word-regexp', () => {
  const args = buildRgArgs(opts({ wholeWord: true }));
  assert.ok(args.includes('--word-regexp'));
});

test('contextBoth overrides A and B', () => {
  const args = buildRgArgs(opts({ contextBefore: 1, contextAfter: 2, contextBoth: 3 }));
  assert.ok(args.includes('-C'));
  assert.equal(args[args.indexOf('-C') + 1], '3');
  assert.ok(!args.includes('-A'));
  assert.ok(!args.includes('-B'));
});

test('A and B used when contextBoth is 0', () => {
  const args = buildRgArgs(opts({ contextBefore: 1, contextAfter: 2, contextBoth: 0 }));
  assert.equal(args[args.indexOf('-B') + 1], '1');
  assert.equal(args[args.indexOf('-A') + 1], '2');
});

test("contextMode 'split' ignores contextBoth even when set", () => {
  const args = buildRgArgs(
    opts({ contextBefore: 1, contextAfter: 2, contextBoth: 5, contextMode: 'split' }),
  );
  assert.ok(!args.includes('-C'));
  assert.equal(args[args.indexOf('-B') + 1], '1');
  assert.equal(args[args.indexOf('-A') + 1], '2');
});

test("contextMode 'both' ignores A/B even when set", () => {
  const args = buildRgArgs(
    opts({ contextBefore: 1, contextAfter: 2, contextBoth: 5, contextMode: 'both' }),
  );
  assert.ok(!args.includes('-A'));
  assert.ok(!args.includes('-B'));
  assert.equal(args[args.indexOf('-C') + 1], '5');
});

test('globs become include and negated exclude args', () => {
  const args = buildRgArgs(
    opts({ includeGlobs: ['src/**/*.ts'], excludeGlobs: ['**/node_modules/**'] }),
  );
  assert.ok(args.includes('src/**/*.ts'));
  assert.ok(args.includes('!**/node_modules/**'));
});

test('pattern always comes after -- guard', () => {
  const args = buildRgArgs(opts({ query: '-x' }));
  assert.equal(args[args.length - 2], '--');
  assert.equal(args[args.length - 1], '-x');
});
