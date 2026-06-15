import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLayout, gridShape, clampCount } from '../src/grid/layout';

function leafCount(groups: { groups?: unknown[] }[]): number {
  let n = 0;
  for (const g of groups) {
    if (g.groups) {
      n += leafCount(g.groups as { groups?: unknown[] }[]);
    } else {
      n += 1;
    }
  }
  return n;
}

test('gridShape for 1..9', () => {
  assert.deepEqual(gridShape(1), { rows: 1, cols: 1 });
  assert.deepEqual(gridShape(2), { rows: 1, cols: 2 });
  assert.deepEqual(gridShape(3), { rows: 1, cols: 3 });
  assert.deepEqual(gridShape(4), { rows: 2, cols: 2 });
  assert.deepEqual(gridShape(6), { rows: 2, cols: 3 });
  assert.deepEqual(gridShape(9), { rows: 3, cols: 3 });
});

test('buildLayout leaf count equals clamped count', () => {
  for (let n = 1; n <= 9; n++) {
    const layout = buildLayout(n, 9);
    assert.equal(leafCount(layout.groups), n, `n=${n}`);
  }
});

test('buildLayout 4 is a 2x2 grid', () => {
  const layout = buildLayout(4, 9);
  assert.equal(layout.groups.length, 2); // two rows
  assert.equal(layout.groups[0].groups?.length, 2);
  assert.equal(layout.groups[1].groups?.length, 2);
});

test('buildLayout clamps to max', () => {
  const layout = buildLayout(20, 4);
  assert.equal(leafCount(layout.groups), 4);
});

test('clampCount respects floor of 1 and ceiling of max', () => {
  assert.equal(clampCount(0, 9), 1);
  assert.equal(clampCount(5, 9), 5);
  assert.equal(clampCount(50, 9), 9);
});

test('5 items fill first row then partial second', () => {
  const layout = buildLayout(5, 9); // 2x3 shape, 5 items
  assert.equal(layout.groups[0].groups?.length, 3);
  assert.equal(layout.groups[1].groups?.length, 2);
});
