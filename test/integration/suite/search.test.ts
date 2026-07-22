// End-to-end checks running inside a real VS Code instance, with the
// `examples/` folder as the workspace.
import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { SearchService } from '../../../src/search/searchService';
import type { SearchOptions } from '../../../src/models';

function options(overrides: Partial<SearchOptions> = {}): SearchOptions {
  return {
    query: 'calculateInvoiceTotal',
    isRegex: false,
    caseSensitive: false,
    wholeWord: false,
    contextAfter: 0,
    contextBefore: 0,
    contextBoth: 2,
    includeGlobs: [],
    excludeGlobs: [],
    ...overrides,
  };
}

suite('Grep Finder integration', () => {
  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('RobertoRiquelmeSaez.grep-finder');
    await ext?.activate();
  });

  test('registers the focus command', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('grepFinder.focus'), 'focus command should be registered');
  });

  test('finds a shared token across nested folders', async () => {
    const folders = vscode.workspace.workspaceFolders;
    assert.ok(folders && folders.length > 0, 'examples workspace should be open');

    const service = new SearchService();
    const model = await service.search(options(), folders!);

    assert.ok(model.totalMatches > 0, 'expected at least one match');
    assert.ok(model.files.length >= 4, `expected matches in several files, got ${model.files.length}`);

    // Every reported file should actually be unique.
    const uris = model.files.map((f) => f.fileUri);
    assert.equal(new Set(uris).size, uris.length, 'file results should be unique');

    // Context lines (-C 2) should accompany matches.
    const aBlock = model.files[0].blocks[0];
    assert.ok(aBlock.lines.some((l) => !l.isMatch), 'expected context lines around the match');
    assert.ok(aBlock.lines.some((l) => l.isMatch), 'expected a match line');
  });

  test('case-sensitive search narrows the results', async () => {
    const folders = vscode.workspace.workspaceFolders!;
    const service = new SearchService();
    const loose = await service.search(options({ query: 'rounding' }), folders);
    const strict = await service.search(
      options({ query: 'ROUNDING', caseSensitive: true }),
      folders,
    );
    assert.ok(loose.totalMatches > 0, 'expected loose matches for "rounding"');
    assert.equal(strict.totalMatches, 0, 'expected no case-sensitive matches for "ROUNDING"');
  });
});
