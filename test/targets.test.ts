import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dedupeByFile } from '../src/grid/targets';
import type { OpenTarget } from '../src/models';

function t(fileUri: string, anchorLine: number, anchorColumn = 0): OpenTarget {
  return { fileUri, anchorLine, anchorColumn };
}

test('dedupeByFile keeps the first target of each file', () => {
  const out = dedupeByFile([t('file:///a.ts', 10), t('file:///a.ts', 40), t('file:///b.ts', 3)]);
  assert.deepEqual(out, [t('file:///a.ts', 10), t('file:///b.ts', 3)]);
});

test('dedupeByFile preserves the original file order', () => {
  const out = dedupeByFile([
    t('file:///b.ts', 1),
    t('file:///a.ts', 2),
    t('file:///b.ts', 3),
    t('file:///c.ts', 4),
  ]);
  assert.deepEqual(
    out.map((x) => x.fileUri),
    ['file:///b.ts', 'file:///a.ts', 'file:///c.ts'],
  );
});

test('dedupeByFile is a no-op on distinct files', () => {
  const input = [t('file:///a.ts', 1), t('file:///b.ts', 2), t('file:///c.ts', 3)];
  assert.deepEqual(dedupeByFile(input), input);
});

test('dedupeByFile handles an empty list', () => {
  assert.deepEqual(dedupeByFile([]), []);
});

test('dedupeByFile does not mutate its input', () => {
  const input = [t('file:///a.ts', 1), t('file:///a.ts', 2)];
  dedupeByFile(input);
  assert.equal(input.length, 2);
});
