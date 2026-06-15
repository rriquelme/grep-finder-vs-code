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

test('fixed string by default, smart-case on', () => {
  const args = buildRgArgs(opts(), { useSmartCase: true });
  assert.deepEqual(args, ['--json', '--fixed-strings', '--smart-case', '--', 'foo']);
});

test('regex disables fixed-strings', () => {
  const args = buildRgArgs(opts({ isRegex: true }), { useSmartCase: true });
  assert.ok(!args.includes('--fixed-strings'));
});

test('case sensitive overrides smart-case', () => {
  const args = buildRgArgs(opts({ caseSensitive: true }), { useSmartCase: true });
  assert.ok(args.includes('--case-sensitive'));
  assert.ok(!args.includes('--smart-case'));
});

test('whole word adds --word-regexp', () => {
  const args = buildRgArgs(opts({ wholeWord: true }), { useSmartCase: false });
  assert.ok(args.includes('--word-regexp'));
});

test('contextBoth overrides A and B', () => {
  const args = buildRgArgs(
    opts({ contextBefore: 1, contextAfter: 2, contextBoth: 3 }),
    { useSmartCase: true },
  );
  assert.ok(args.includes('-C'));
  assert.equal(args[args.indexOf('-C') + 1], '3');
  assert.ok(!args.includes('-A'));
  assert.ok(!args.includes('-B'));
});

test('A and B used when contextBoth is 0', () => {
  const args = buildRgArgs(
    opts({ contextBefore: 1, contextAfter: 2, contextBoth: 0 }),
    { useSmartCase: true },
  );
  assert.equal(args[args.indexOf('-B') + 1], '1');
  assert.equal(args[args.indexOf('-A') + 1], '2');
});

test('globs become include and negated exclude args', () => {
  const args = buildRgArgs(
    opts({ includeGlobs: ['src/**/*.ts'], excludeGlobs: ['**/node_modules/**'] }),
    { useSmartCase: true },
  );
  assert.ok(args.includes('src/**/*.ts'));
  assert.ok(args.includes('!**/node_modules/**'));
});

test('pattern always comes after -- guard', () => {
  const args = buildRgArgs(opts({ query: '-x' }), { useSmartCase: true });
  assert.equal(args[args.length - 2], '--');
  assert.equal(args[args.length - 1], '-x');
});
