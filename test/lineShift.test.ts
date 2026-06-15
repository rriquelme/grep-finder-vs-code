import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyEditsToModel, type LineEdit } from '../src/search/lineShift';
import type { SearchModel } from '../src/models';

const URI = 'file:///proj/a.ts';

function model(lines: number[]): SearchModel {
  // One block per given anchor line, each with a single match line.
  return {
    truncated: false,
    totalMatches: lines.length,
    files: [
      {
        fileUri: URI,
        relPath: 'a.ts',
        blocks: lines.map((ln, i) => ({
          id: `${URI}#${i}`,
          fileUri: URI,
          anchorLine: ln,
          anchorColumn: 0,
          lines: [{ lineNumber: ln, text: 'x', isMatch: true }],
        })),
      },
    ],
  };
}

function anchors(m: SearchModel): number[] {
  return m.files[0].blocks.map((b) => b.anchorLine);
}

test('inserting lines shifts later matches down', () => {
  const m = model([5, 20, 40]);
  // Insert 2 lines at line 10 (replace line 10 with 3 lines): start=9,end=9,added=2.
  const edits: LineEdit[] = [{ startLine: 9, endLine: 9, addedLines: 2 }];
  assert.equal(applyEditsToModel(m, URI, edits), true);
  assert.deepEqual(anchors(m), [5, 22, 42]);
});

test('matches above the edit are untouched', () => {
  const m = model([5, 20]);
  applyEditsToModel(m, URI, [{ startLine: 24, endLine: 24, addedLines: 3 }]);
  assert.deepEqual(anchors(m), [5, 20]);
});

test('deleting lines shifts later matches up', () => {
  const m = model([5, 30]);
  // Delete 3 lines: replace lines 10..13 with 1 line → start=9,end=12,added=0 → delta=-3.
  applyEditsToModel(m, URI, [{ startLine: 9, endLine: 12, addedLines: 0 }]);
  assert.deepEqual(anchors(m), [5, 27]);
});

test('match line text numbers shift too', () => {
  const m = model([40]);
  applyEditsToModel(m, URI, [{ startLine: 0, endLine: 0, addedLines: 5 }]);
  assert.equal(m.files[0].blocks[0].lines[0].lineNumber, 45);
  assert.equal(m.files[0].blocks[0].anchorLine, 45);
});

test('no net line change does nothing', () => {
  const m = model([5, 20]);
  assert.equal(applyEditsToModel(m, URI, [{ startLine: 2, endLine: 2, addedLines: 0 }]), false);
  assert.deepEqual(anchors(m), [5, 20]);
});

test('multiple edits compose correctly', () => {
  const m = model([5, 20, 40]);
  // +2 at line 10, then -1 at line 30.
  const edits: LineEdit[] = [
    { startLine: 9, endLine: 9, addedLines: 2 }, // delta +2 below line 10
    { startLine: 29, endLine: 30, addedLines: 0 }, // delta -1 below line 31
  ];
  applyEditsToModel(m, URI, edits);
  // 5 unchanged; 20 -> 22 (+2); 40 -> 42 (+2) then -1 -> 41.
  assert.deepEqual(anchors(m), [5, 22, 41]);
});

test('edits to other files are ignored', () => {
  const m = model([5, 20]);
  assert.equal(applyEditsToModel(m, 'file:///proj/other.ts', [{ startLine: 0, endLine: 0, addedLines: 9 }]), false);
  assert.deepEqual(anchors(m), [5, 20]);
});
