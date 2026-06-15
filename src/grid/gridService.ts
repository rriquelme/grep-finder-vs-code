// Opens a set of matches in a tiled editor layout, each editor revealed and
// centered on its match. Each editor is an independent group, so the user
// navigates each one independently.
import * as vscode from 'vscode';
import { buildLayout, clampCount } from './layout';

export interface GridTarget {
  fileUri: string;
  /** 1-based line to reveal/center. */
  anchorLine: number;
  /** 0-based column of the match start. */
  anchorColumn: number;
}

export async function openInGrid(targets: GridTarget[]): Promise<void> {
  if (targets.length === 0) {
    return;
  }

  const max = vscode.workspace.getConfiguration('enhancedFinder').get<number>('maxGridEditors', 9);
  const count = clampCount(targets.length, max);

  if (targets.length > max) {
    void vscode.window.showWarningMessage(
      `Enhanced Finder: opening the first ${max} of ${targets.length} selected matches (enhancedFinder.maxGridEditors).`,
    );
  }

  const layout = buildLayout(count, max);
  await vscode.commands.executeCommand('vscode.setEditorLayout', layout);

  for (let i = 0; i < count; i++) {
    const t = targets[i];
    const line = Math.max(0, t.anchorLine - 1); // to 0-based
    const col = Math.max(0, t.anchorColumn);
    const pos = new vscode.Position(line, col);
    const selection = new vscode.Selection(pos, pos);
    const viewColumn = (i + 1) as vscode.ViewColumn;

    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(t.fileUri));
      const editor = await vscode.window.showTextDocument(doc, {
        viewColumn,
        selection,
        preview: false,
        preserveFocus: i !== 0,
      });
      editor.revealRange(selection, vscode.TextEditorRevealType.InCenter);
    } catch (err) {
      void vscode.window.showErrorMessage(
        `Enhanced Finder: could not open ${t.fileUri}: ${String(err)}`,
      );
    }
  }
}
