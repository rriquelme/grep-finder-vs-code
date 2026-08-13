// Opens a set of matches in a tiled editor layout, each editor revealed and
// centered on its match. Each editor is an independent group, so the user
// navigates each one independently.
import * as vscode from 'vscode';
import { buildLayout, clampCount } from './layout';
import { showTarget } from './reveal';
import type { OpenTarget } from '../models';

export async function openInGrid(targets: OpenTarget[]): Promise<void> {
  if (targets.length === 0) {
    return;
  }

  const max = vscode.workspace.getConfiguration('grepFinder').get<number>('maxGridEditors', 9);
  const count = clampCount(targets.length, max);

  if (targets.length > max) {
    void vscode.window.showWarningMessage(
      `Grep Finder: opening the first ${max} of ${targets.length} selected matches (grepFinder.maxGridEditors).`,
    );
  }

  const layout = buildLayout(count, max);
  await vscode.commands.executeCommand('vscode.setEditorLayout', layout);

  for (let i = 0; i < count; i++) {
    const t = targets[i];
    try {
      await showTarget(t, {
        viewColumn: (i + 1) as vscode.ViewColumn,
        preserveFocus: i !== 0,
      });
    } catch (err) {
      void vscode.window.showErrorMessage(
        `Grep Finder: could not open ${t.fileUri}: ${String(err)}`,
      );
    }
  }
}
