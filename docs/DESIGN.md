# Enhanced Finder — Design & Implementation Plan

## 1. Goal

Build a VS Code extension that:

1. Adds an entry to the **Activity Bar** (left icon strip) like the built-in
   Search, with its own icon and view.
2. Finds text across the workspace **like the regular find** (case, whole
   word, regex, include/exclude globs).
3. Also behaves **like `grep` with `-A` / `-B` / `-C`**, showing a
   configurable number of context lines after / before / around each match.
4. Can **open multiple matching files at once at the exact matched region**
   in a tiled (grid) layout — e.g. 4 files in a 2×2 grid — where each editor
   is scrolled to its match and **navigated independently**.

## 2. High-level architecture

```
┌─────────────────────────────────────────────────────────┐
│ Activity Bar container "Enhanced Finder" (custom icon)    │
│   └── Webview View: search form + grouped results         │
└───────────────┬─────────────────────────────────────────┘
                │ postMessage  ▲ results / state
                ▼              │
┌─────────────────────────────────────────────────────────┐
│ Extension host (Node)                                     │
│   • SearchService  → spawns ripgrep (--json) per query    │
│   • RgJsonParser   → stream events → SearchModel          │
│   • GridService    → setEditorLayout + reveal each match  │
└─────────────────────────────────────────────────────────┘
```

- **UI**: a Webview View (not a TreeView) so we can render grep-style
  context blocks with line numbers, highlighting, and multi-select
  checkboxes — a tree can't show context lines cleanly.
- **Search backend**: **ripgrep**, which VS Code already bundles. The
  `@vscode/ripgrep` package exposes `rgPath`. ripgrep supports `-A/-B/-C`
  natively and emits structured `--json` events, so we don't reimplement
  context extraction.
- **Grid open**: VS Code's `vscode.setEditorLayout` command + per-editor
  `showTextDocument` with a `selection`, then `revealRange`.

## 3. Search backend (ripgrep)

Spawn ripgrep with `--json` and map the user's options to flags:

| UI option            | ripgrep flag                          |
|----------------------|---------------------------------------|
| Query                | positional pattern                    |
| Regex / plain text   | (default regex) or `--fixed-strings`  |
| Case sensitive       | `--case-sensitive` / `--smart-case`   |
| Whole word           | `--word-regexp`                       |
| After context (A)    | `-A N`                                |
| Before context (B)   | `-B N`                                |
| Both (C)             | `-C N` (overrides A/B)                |
| Include glob         | `-g <glob>` (repeatable)              |
| Exclude glob         | `-g !<glob>` (repeatable)             |
| Max results          | `-m` per file / cap in host           |

`rg --json` emits newline-delimited JSON events: `begin`, `match`,
`context`, `end`, `summary`. We parse the stream incrementally:

```ts
type RgEvent =
  | { type: 'begin';   data: { path: { text: string } } }
  | { type: 'match';   data: { path; lines; line_number; submatches: { match: { text }, start, end }[] } }
  | { type: 'context'; data: { path; lines; line_number } }
  | { type: 'end';     data: { path; stats } }
  | { type: 'summary'; data: { stats } };
```

Group consecutive `context`/`match` events between `begin` and `end` into
**match blocks** so each block reflects the `-A/-B/-C` window around a match
(ripgrep inserts a separator when blocks are non-contiguous).

### Data model

```ts
interface MatchSubrange { startCol: number; endCol: number; }

interface ResultLine {
  lineNumber: number;        // 1-based
  text: string;
  isMatch: boolean;          // true = match line, false = context line
  matches?: MatchSubrange[]; // highlight ranges (match lines only)
}

interface MatchBlock {
  id: string;                // stable id for selection
  fileUri: string;
  anchorLine: number;        // the match line to reveal/center
  lines: ResultLine[];       // before-context + match(es) + after-context
}

interface FileResult { fileUri: string; relPath: string; blocks: MatchBlock[]; }
interface SearchModel { files: FileResult[]; truncated: boolean; stats: {...}; }
```

Performance: cap total results (configurable), debounce input, and cancel the
previous `rg` child process (`AbortController` / `child.kill()`) when a new
query starts.

## 4. UI / Webview

The search view contains:

- **Query row**: text input + toggles for case / whole word / regex
  (reuse VS Code codicons so it feels native).
- **Context row**: numeric inputs for A, B, C. Setting C disables/overrides
  A and B (matching grep semantics), with a hint.
- **Scope row**: "files to include" and "files to exclude" glob inputs.
- **Results**: grouped by file. Each file is collapsible; each match block
  renders its context lines with line numbers, the match line highlighted,
  and a checkbox to add it to the grid selection. A separator (`⋯`) between
  non-contiguous blocks in the same file.
- **Action bar**: live count of selected matches and an **"Open N in grid"**
  button (enabled when ≥1 selected); plus "Select all" / "Clear".

Messaging contract (webview ↔ host) via `postMessage`:

- → host: `search`, `cancel`, `openMatch`, `openGrid(selectedIds)`,
  `toggleSelect`, `updateOptions`.
- → webview: `results` (incremental/append), `done`, `error`, `restoreState`.

Clicking a match line (not the checkbox) opens that single match (reveal at
line). The checkbox builds the grid selection.

## 5. The differentiator — "Open N in grid"

Given the selected match blocks (each = file URI + anchor line):

1. **Compute a layout** for N (capped by `enhancedFinder.maxGridEditors`,
   default 9):
   - 1 → single
   - 2 → 1×2 (side by side)
   - 3 → 1×3
   - 4 → 2×2
   - 5–6 → 2×3
   - 7–9 → 3×3
   Build the `EditorGroupLayout` tree (`orientation` + nested `groups`) and
   apply it with:
   ```ts
   await vscode.commands.executeCommand('vscode.setEditorLayout', layout);
   ```
2. **Open each match in its own group**, scrolled to the match:
   ```ts
   const sel = new vscode.Selection(line, col, line, col);
   const editor = await vscode.window.showTextDocument(uri, {
     viewColumn: groupColumn,   // ViewColumn.One, .Two, ...
     selection: sel,
     preview: false,            // keep all of them open, no preview reuse
   });
   editor.revealRange(sel, vscode.TextEditorRevealType.InCenter);
   ```
3. Because each match is a **separate editor in a separate group**, the user
   scrolls/edits/navigates each **independently** — no extra work needed.
   The same file selected twice opens two editors (two groups) so two regions
   of one file can be compared too.

Optional future toggle: "synchronized scrolling" across the grid (listen to
`onDidChangeTextEditorVisibleRanges` and mirror deltas). Default OFF to honor
the "navigate independently" requirement.

## 6. `package.json` contributions (sketch)

```jsonc
"contributes": {
  "viewsContainers": {
    "activitybar": [{
      "id": "enhancedFinder",
      "title": "Enhanced Finder",
      "icon": "media/icon.svg"
    }]
  },
  "views": {
    "enhancedFinder": [{
      "id": "enhancedFinder.searchView",
      "type": "webview",
      "name": "Enhanced Finder"
    }]
  },
  "commands": [
    { "command": "enhancedFinder.focus",     "title": "Enhanced Finder: Focus Search" },
    { "command": "enhancedFinder.openGrid",  "title": "Enhanced Finder: Open Selected in Grid" }
  ],
  "keybindings": [
    { "command": "enhancedFinder.focus", "key": "ctrl+alt+f", "mac": "cmd+alt+f" }
  ],
  "configuration": {
    "title": "Enhanced Finder",
    "properties": {
      "enhancedFinder.defaultContextLines": { "type": "number", "default": 2 },
      "enhancedFinder.maxGridEditors":      { "type": "number", "default": 9 },
      "enhancedFinder.maxResults":          { "type": "number", "default": 2000 },
      "enhancedFinder.useSmartCase":        { "type": "boolean", "default": true }
    }
  }
}
```

`activationEvents`: `onView:enhancedFinder.searchView` (and the focus command).

## 7. Proposed file structure

```
package.json
tsconfig.json
esbuild.js                     # bundle extension + webview
.vscodeignore
src/
  extension.ts                 # activate(): register view + commands
  models.ts                    # data model (section 3)
  search/
    searchService.ts           # build args, spawn/cancel ripgrep
    rgJsonParser.ts            # stream parser → SearchModel
  view/
    searchViewProvider.ts      # WebviewViewProvider + message routing
  grid/
    gridService.ts             # layout computation + setEditorLayout + reveal
    layout.ts                  # N → EditorGroupLayout
media/
  icon.svg                     # activity bar icon
  main.js                      # webview front-end
  main.css                     # webview styling (uses VS Code theme vars)
test/
  layout.test.ts
  rgJsonParser.test.ts
docs/DESIGN.md                 # this file
```

## 8. Implementation milestones

1. **Scaffold** — manifest with Activity Bar container + webview view +
   icon; esbuild build; "hello" webview renders in the sidebar.
2. **Search core** — `searchService` + `rgJsonParser`; unit tests on sample
   `rg --json` output; log a `SearchModel` for a query.
3. **Results UI** — render grouped results with context lines, highlights,
   collapsible files; wire query + option controls; debounce + cancel.
4. **Single open** — click a match → reveal at line.
5. **Grid open** — multi-select + layout computation + `setEditorLayout` +
   per-editor reveal (the headline feature). Tests for `layout(N)`.
6. **Polish** — settings, keybindings, smart-case, glob scope, empty/error
   states, result cap + "truncated" notice.
7. **Package** — README, icon, `vsce package`, marketplace metadata.

## 9. Key risks / decisions

- **ripgrep source**: depend on `@vscode/ripgrep` for `rgPath`, with a
  setting to override the binary path. (Avoids assuming the user's VS Code
  internal copy is reachable.)
- **Webview vs TreeView**: Webview chosen for rich context rendering and
  multi-select; cost is we manage our own DOM + state persistence
  (`getState`/`setState`, and `retainContextWhenHidden`).
- **Grid cap**: `setEditorLayout` can technically open many groups, but UX
  degrades; cap at 9 and warn if a selection exceeds it.
- **Large workspaces**: stream results incrementally, cap totals, cancel
  stale searches.
```
