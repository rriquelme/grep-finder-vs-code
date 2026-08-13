// Pure target-list logic shared by both open modes (grid and tabs). No vscode
// import here, so it stays unit-testable.
import type { OpenTarget } from '../models';

/**
 * Collapse a target list to one entry per file, keeping the first (top-most)
 * target of each file.
 *
 * Tabs mode needs this: a file can only ever have one tab, so a second match in
 * the same file would re-reveal the editor that is already open, move the
 * cursor away from the first match, and still consume one slot of the cap.
 * Grid mode does not dedupe — separate groups showing the same file at
 * different lines is exactly the point there.
 */
export function dedupeByFile(targets: OpenTarget[]): OpenTarget[] {
  const seen = new Set<string>();
  const out: OpenTarget[] = [];
  for (const t of targets) {
    if (seen.has(t.fileUri)) {
      continue;
    }
    seen.add(t.fileUri);
    out.push(t);
  }
  return out;
}
