// Pure helpers to keep search-result line numbers in sync when a file is
// edited, without re-running the search. Free of vscode imports so it can be
// unit-tested.
import type { SearchModel } from '../models';

/** A normalized text edit: replaces lines [startLine, endLine] (0-based,
 *  inclusive) with `addedLines + 1` lines of text. */
export interface LineEdit {
  startLine: number;
  endLine: number;
  /** Number of newline characters in the inserted text. */
  addedLines: number;
}

/** Net change in line count for a single edit. */
function lineDelta(edit: LineEdit): number {
  return edit.addedLines - (edit.endLine - edit.startLine);
}

/**
 * Shift the stored line numbers of every result in `fileUri` to account for
 * `edits`. Lines strictly below an edit move by the edit's line delta; lines
 * inside or above it are left as-is. Mutates `model` in place and returns true
 * if anything changed.
 *
 * Edits are processed bottom-up so each edit's (pre-edit) coordinates stay
 * valid as we go.
 */
export function applyEditsToModel(
  model: SearchModel,
  fileUri: string,
  edits: LineEdit[],
): boolean {
  const file = model.files.find((f) => f.fileUri === fileUri);
  if (!file || edits.length === 0) {
    return false;
  }

  const ordered = [...edits].sort((a, b) => b.startLine - a.startLine);
  let changed = false;

  for (const edit of ordered) {
    const delta = lineDelta(edit);
    if (delta === 0) {
      continue;
    }
    // `endLine` is 0-based; result line numbers are 1-based.
    const pivot = edit.endLine + 1; // shift result lines with lineNumber > pivot
    for (const block of file.blocks) {
      if (block.anchorLine > pivot) {
        block.anchorLine += delta;
        changed = true;
      }
      for (const line of block.lines) {
        if (line.lineNumber > pivot) {
          line.lineNumber += delta;
          changed = true;
        }
      }
    }
  }

  return changed;
}
