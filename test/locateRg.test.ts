import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { locateRgBinary } from '../src/search/rgLocate';

function makeBinary(root: string, relDir: string, exe: string): string {
  const dir = path.join(root, relDir);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, exe);
  fs.writeFileSync(file, '');
  return file;
}

function tmpRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ef-rg-'));
}

test('finds VS Code 1.122+ @vscode/ripgrep-universal layout', () => {
  const root = tmpRoot();
  const expected = makeBinary(
    root,
    path.join('node_modules', '@vscode', 'ripgrep-universal', 'bin', 'linux-x64'),
    'rg',
  );
  const result = locateRgBinary(root, 'linux', 'x64');
  assert.equal(result.path, expected);
});

test('finds legacy @vscode/ripgrep bin/rg layout', () => {
  const root = tmpRoot();
  const expected = makeBinary(
    root,
    path.join('node_modules', '@vscode', 'ripgrep', 'bin'),
    'rg',
  );
  const result = locateRgBinary(root, 'linux', 'x64');
  assert.equal(result.path, expected);
});

test('finds binary under node_modules.asar.unpacked', () => {
  const root = tmpRoot();
  const expected = makeBinary(
    root,
    path.join('node_modules.asar.unpacked', '@vscode', 'ripgrep-universal', 'bin', 'darwin-arm64'),
    'rg',
  );
  const result = locateRgBinary(root, 'darwin', 'arm64');
  assert.equal(result.path, expected);
});

test('uses rg.exe on win32', () => {
  const root = tmpRoot();
  const expected = makeBinary(
    root,
    path.join('node_modules', '@vscode', 'ripgrep-universal', 'bin', 'win32-x64'),
    'rg.exe',
  );
  const result = locateRgBinary(root, 'win32', 'x64');
  assert.equal(result.path, expected);
});

test('scan fallback finds a future @vscode/ripgrep* rename', () => {
  const root = tmpRoot();
  const expected = makeBinary(
    root,
    path.join('node_modules', '@vscode', 'ripgrep-next', 'bin', 'linux-arm64'),
    'rg',
  );
  const result = locateRgBinary(root, 'linux', 'arm64');
  assert.equal(result.path, expected);
});

test('returns undefined with tried list when nothing matches', () => {
  const root = tmpRoot();
  const result = locateRgBinary(root, 'linux', 'x64');
  assert.equal(result.path, undefined);
  assert.ok(result.tried.length > 0);
  assert.ok(result.tried.some((t) => t.includes('ripgrep-universal')));
});

test('no appRoot yields empty result', () => {
  const result = locateRgBinary(undefined, 'linux', 'x64');
  assert.equal(result.path, undefined);
  assert.deepEqual(result.tried, []);
});
