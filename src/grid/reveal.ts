// Opening a single target, shared by both open modes.
import * as vscode from 'vscode';
import type { OpenTarget } from '../models';

/** Open `target` as a pinned editor and centre it on the match. */
export async function showTarget(
  target: OpenTarget,
  opts: { viewColumn?: vscode.ViewColumn; preserveFocus: boolean },
): Promise<void> {
  const line = Math.max(0, target.anchorLine - 1); // to 0-based
  const col = Math.max(0, target.anchorColumn);
  const pos = new vscode.Position(line, col);
  const selection = new vscode.Selection(pos, pos);

  const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(target.fileUri));
  const editor = await vscode.window.showTextDocument(doc, {
    viewColumn: opts.viewColumn,
    selection,
    preview: false,
    preserveFocus: opts.preserveFocus,
  });
  editor.revealRange(selection, vscode.TextEditorRevealType.InCenter);
}
