import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RgJsonParser } from '../src/search/rgJsonParser';

// Build a ripgrep --json line as ripgrep would emit it.
function line(obj: unknown): string {
  return JSON.stringify(obj) + '\n';
}

function newParser(max = Number.POSITIVE_INFINITY) {
  return new RgJsonParser(
    (abs) => abs.replace('/root/', ''),
    (abs) => `file://${abs}`,
    max,
  );
}

test('parses a single match with context into one block', () => {
  const p = newParser();
  p.push(line({ type: 'begin', data: { path: { text: '/root/a.ts' } } }));
  p.push(line({ type: 'context', data: { path: { text: '/root/a.ts' }, lines: { text: 'before\n' }, line_number: 9 } }));
  p.push(
    line({
      type: 'match',
      data: {
        path: { text: '/root/a.ts' },
        lines: { text: 'the foo line\n' },
        line_number: 10,
        submatches: [{ match: { text: 'foo' }, start: 4, end: 7 }],
      },
    }),
  );
  p.push(line({ type: 'context', data: { path: { text: '/root/a.ts' }, lines: { text: 'after\n' }, line_number: 11 } }));
  p.push(line({ type: 'end', data: { path: { text: '/root/a.ts' } } }));
  const model = p.finish();

  assert.equal(model.files.length, 1);
  assert.equal(model.files[0].relPath, 'a.ts');
  assert.equal(model.files[0].fileUri, 'file:///root/a.ts');
  assert.equal(model.files[0].blocks.length, 1);

  const block = model.files[0].blocks[0];
  assert.equal(block.lines.length, 3);
  assert.equal(block.anchorLine, 10);
  assert.equal(block.anchorColumn, 4);
  assert.ok(block.id.startsWith('file:///root/a.ts#'));
  assert.deepEqual(block.lines.map((l) => l.isMatch), [false, true, false]);
  assert.deepEqual(block.lines[1].matches, [{ startCol: 4, endCol: 7 }]);
  assert.equal(model.totalMatches, 1);
});

test('non-contiguous lines split into separate blocks', () => {
  const p = newParser();
  p.push(line({ type: 'begin', data: { path: { text: '/root/a.ts' } } }));
  p.push(line({ type: 'match', data: { path: { text: '/root/a.ts' }, lines: { text: 'a\n' }, line_number: 5, submatches: [{ match: { text: 'a' }, start: 0, end: 1 }] } }));
  p.push(line({ type: 'match', data: { path: { text: '/root/a.ts' }, lines: { text: 'b\n' }, line_number: 50, submatches: [{ match: { text: 'b' }, start: 0, end: 1 }] } }));
  p.push(line({ type: 'end', data: { path: { text: '/root/a.ts' } } }));
  const model = p.finish();
  assert.equal(model.files[0].blocks.length, 2);
  assert.equal(model.files[0].blocks[0].anchorLine, 5);
  assert.equal(model.files[0].blocks[1].anchorLine, 50);
});

test('handles base64 bytes encoding', () => {
  const p = newParser();
  const text = 'foo bar';
  p.push(line({ type: 'begin', data: { path: { bytes: Buffer.from('/root/b.ts').toString('base64') } } }));
  p.push(
    line({
      type: 'match',
      data: {
        path: { bytes: Buffer.from('/root/b.ts').toString('base64') },
        lines: { bytes: Buffer.from(text + '\n').toString('base64') },
        line_number: 1,
        submatches: [{ match: { text: 'foo' }, start: 0, end: 3 }],
      },
    }),
  );
  p.push(line({ type: 'end', data: { path: { text: '/root/b.ts' } } }));
  const model = p.finish();
  assert.equal(model.files[0].blocks[0].lines[0].text, 'foo bar');
});

test('truncates when maxResults reached', () => {
  const p = newParser(2);
  p.push(line({ type: 'begin', data: { path: { text: '/root/a.ts' } } }));
  for (let i = 1; i <= 5; i++) {
    p.push(line({ type: 'match', data: { path: { text: '/root/a.ts' }, lines: { text: 'x\n' }, line_number: i, submatches: [{ match: { text: 'x' }, start: 0, end: 1 }] } }));
  }
  const model = p.finish();
  assert.ok(model.truncated);
  assert.ok(model.totalMatches <= 5);
});

test('chunk boundaries split mid-line are reassembled', () => {
  const p = newParser();
  const full = line({ type: 'begin', data: { path: { text: '/root/a.ts' } } }) +
    line({ type: 'match', data: { path: { text: '/root/a.ts' }, lines: { text: 'hello\n' }, line_number: 1, submatches: [{ match: { text: 'hello' }, start: 0, end: 5 }] } });
  const mid = Math.floor(full.length / 2);
  p.push(full.slice(0, mid));
  p.push(full.slice(mid));
  const model = p.finish();
  assert.equal(model.files[0].blocks[0].lines[0].text, 'hello');
});
