// Opens a set of matches as ordinary editor tabs in the active group, each one
// revealed and centered on its match. Unlike the grid mode this never touches
// the window's editor layout — whatever splits the user already had survive.
import * as vscode from 'vscode';
import { clampCount } from './layout';
import { dedupeByFile } from './targets';
import { showTarget } from './reveal';
import type { OpenTarget } from '../models';

export async function openInTabs(targets: OpenTarget[]): Promise<void> {
  if (targets.length === 0) {
    return;
  }

  // One tab per file: a second match in the same file would only re-reveal the
  // tab that is already open.
  const unique = dedupeByFile(targets);
  const max = vscode.workspace.getConfiguration('grepFinder').get<number>('maxTabEditors', 20);
  const count = clampCount(unique.length, max);

  if (unique.length > max) {
    void vscode.window.showWarningMessage(
      `Grep Finder: opening the first ${max} of ${unique.length} selected files (grepFinder.maxTabEditors).`,
    );
  }

  const opened: OpenTarget[] = [];
  for (let i = 0; i < count; i++) {
    const t = unique[i];
    try {
      // preserveFocus keeps the tabs appearing in order without the panel
      // losing focus half-way through.
      await showTarget(t, { viewColumn: vscode.ViewColumn.Active, preserveFocus: true });
      opened.push(t);
    } catch (err) {
      void vscode.window.showErrorMessage(
        `Grep Finder: could not open ${t.fileUri}: ${String(err)}`,
      );
    }
  }

  // Land on the first match rather than on whichever tab happened to be last.
  if (opened.length > 0) {
    try {
      await showTarget(opened[0], { viewColumn: vscode.ViewColumn.Active, preserveFocus: false });
    } catch {
      // Already opened once above; a failure here is not worth a second toast.
    }
  }
}
