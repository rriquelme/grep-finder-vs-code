// Pure layout computation: map a count N to a VS Code EditorGroupLayout tree
// and to the order in which view columns are created. Unit-tested.

/** Mirrors vscode's EditorGroupLayout shape (kept local to avoid the import). */
export interface GroupLayoutNode {
  groups?: GroupLayoutNode[];
  size?: number;
}

export interface EditorGroupLayout {
  orientation: 0 | 1; // 0 = Horizontal (rows stacked), 1 = Vertical (columns side by side)
  groups: GroupLayoutNode[];
}

/** Rows x cols grid shape for a given count. */
export function gridShape(n: number): { rows: number; cols: number } {
  switch (n) {
    case 1:
      return { rows: 1, cols: 1 };
    case 2:
      return { rows: 1, cols: 2 };
    case 3:
      return { rows: 1, cols: 3 };
    case 4:
      return { rows: 2, cols: 2 };
    case 5:
    case 6:
      return { rows: 2, cols: 3 };
    default:
      return { rows: 3, cols: 3 }; // 7..9
  }
}

/**
 * Build an EditorGroupLayout for `count` editors (clamped to [1, max]).
 * Orientation 0 stacks rows vertically; each row is split into columns.
 *
 * The resulting flat group order is row-major and matches the ViewColumn
 * numbering VS Code assigns, so editor i goes to ViewColumn i+1.
 */
export function buildLayout(count: number, max: number): EditorGroupLayout {
  const n = Math.max(1, Math.min(count, max));
  const { rows, cols } = gridShape(n);

  const rowNodes: GroupLayoutNode[] = [];
  let placed = 0;
  for (let r = 0; r < rows && placed < n; r++) {
    const remaining = n - placed;
    const inThisRow = Math.min(cols, remaining);
    const colNodes: GroupLayoutNode[] = [];
    for (let c = 0; c < inThisRow; c++) {
      colNodes.push({});
      placed++;
    }
    rowNodes.push({ groups: colNodes });
  }

  return { orientation: 0, groups: rowNodes };
}

/** Number of editors that will actually be opened given a selection and cap. */
export function clampCount(count: number, max: number): number {
  return Math.max(1, Math.min(count, max));
}
