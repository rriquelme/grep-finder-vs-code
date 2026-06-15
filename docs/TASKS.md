# Enhanced Finder — Actionable Task Breakdown

Granular, checkable tasks to take the project from empty repo to a packaged
extension. Tasks are ordered; each lists **what to do**, the **deliverable**,
and **acceptance criteria (AC)**. See [`DESIGN.md`](DESIGN.md) for rationale.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done.

> **Progress (2026-06-15):** **Phases 0–7 complete.** Scaffold, Activity Bar
> view, ripgrep search core, results UI, single open, grid open, settings, UX
> polish (codicons, keyboard nav, spinner, counts), and multi-root support are
> all implemented. Unit tests (args, parser, layout) pass; an integration suite
> (`@vscode/test-electron`) runs in CI under xvfb against `examples/`; `tsc`,
> eslint, and `esbuild` are clean; a GitHub Actions workflow lints/tests/builds
> and uploads the packaged `.vsix`. `npm run package` produces an installable
> extension. The search pipeline is additionally verified against real ripgrep
> on the `examples/` workspace.

---

## Phase 0 — Project scaffold

- [x] **0.1 Init Node/TS project**
  - Add `package.json` (name `enhanced-finder`, publisher placeholder,
    `engines.vscode`), `tsconfig.json`, `.gitignore`, `.vscodeignore`.
  - AC: `npm install` succeeds; `tsc --noEmit` runs clean on an empty `src/`.
- [x] **0.2 Dev dependencies**
  - Add `@types/vscode`, `@types/node`, `typescript`, `esbuild`,
    `@vscode/ripgrep`, `eslint` + config, `@vscode/test-electron` + a test
    runner (e.g. `mocha`).
  - AC: `node_modules` resolves all; `package-lock.json` committed.
- [x] **0.3 Build pipeline**
  - `esbuild.js` bundling `src/extension.ts` → `dist/extension.js`
    (platform `node`, external `vscode`) and `media/main.ts` → `media/main.js`
    (platform `browser`). npm scripts: `build`, `watch`, `lint`, `test`.
  - AC: `npm run build` produces `dist/extension.js`.
- [x] **0.4 Launch config**
  - `.vscode/launch.json` (Extension Development Host) + `tasks.json`.
  - AC: F5 opens an Extension Dev Host with the extension activating.

## Phase 1 — Activity Bar presence (the "sidebar entry")

- [x] **1.1 Activity Bar container + view**
  - In `package.json contributes`: `viewsContainers.activitybar` id
    `enhancedFinder` + `views` webview `enhancedFinder.searchView`.
  - AC: a new icon appears in the Activity Bar; clicking shows an empty view.
- [x] **1.2 Icon asset**
  - Add `media/icon.svg` (monochrome, matches codicon style).
  - AC: icon renders crisply in the Activity Bar (light + dark themes).
- [x] **1.3 WebviewViewProvider skeleton**
  - `src/view/searchViewProvider.ts` registered in `activate()`; loads
    `media/main.js` + `media/main.css` via CSP nonce; `retainContextWhenHidden`.
  - AC: webview renders a "Hello" UI and survives hide/show without reload.
- [x] **1.4 Focus command + keybinding**
  - `enhancedFinder.focus` command + `ctrl+alt+f` / `cmd+alt+f`.
  - AC: keybinding reveals and focuses the search input.

## Phase 2 — Search core (ripgrep)

- [x] **2.1 Data model**
  - `src/models.ts`: `MatchSubrange`, `ResultLine`, `MatchBlock`,
    `FileResult`, `SearchModel`, `SearchOptions` (see DESIGN §3).
  - AC: types compile; exported and documented.
- [x] **2.2 Argument builder**
  - `src/search/searchService.ts`: pure function mapping `SearchOptions`
    → ripgrep argv (query, regex/fixed, case/smart-case, whole-word,
    `-A/-B/-C` with C overriding A/B, include/exclude `-g`, `--json`).
  - AC: unit tests assert exact argv for representative option sets.
- [x] **2.3 Spawn + cancel**
  - Resolve `rgPath` from `@vscode/ripgrep` (override via setting); spawn in
    workspace root; expose cancellation that kills the prior child.
  - AC: starting a new search terminates the previous `rg` process.
- [x] **2.4 JSON stream parser**
  - `src/search/rgJsonParser.ts`: NDJSON line splitter → typed events →
    grouped `MatchBlock`s (context+match between `begin`/`end`, split blocks
    on ripgrep separators), with submatch highlight columns.
  - AC: unit test feeds captured `rg --json` fixtures → expected `SearchModel`.
- [x] **2.5 Limits & safety**
  - Enforce `maxResults` cap, mark `truncated`, debounce queries (~200ms).
  - AC: a query exceeding the cap stops early and sets `truncated=true`.

## Phase 3 — Results UI

- [x] **3.1 Query + option controls**
  - Webview: query input; toggles for case / whole-word / regex; numeric
    A/B/C inputs (C disables A/B with hint); include/exclude glob inputs.
  - AC: editing controls posts `search`/`updateOptions` to the host.
- [x] **3.2 Host ↔ webview messaging**
  - Implement contract (DESIGN §4): host streams `results`/`done`/`error`;
    webview sends `search`/`cancel`/`openMatch`/`openGrid`/`toggleSelect`.
  - AC: typing a query renders results streamed from the host.
- [x] **3.3 Render grouped results**
  - Collapsible file headers; per block render context lines with line
    numbers, highlighted match ranges, `⋯` separators between blocks.
  - AC: results visually mirror `grep -A/-B/-C` for a sample query.
- [x] **3.4 State & empty/error states**
  - Persist query/options/scroll via `getState`/`setState`; show
    empty / no-results / error / truncated banners.
  - AC: reopening the view restores the last query and results summary.

## Phase 4 — Open single match

- [x] **4.1 Reveal at match**
  - `openMatch(blockId)` → `showTextDocument` with `selection` +
    `revealRange(InCenter)`.
  - AC: clicking a match line opens the file scrolled/centered on that line
    with the match selected.

## Phase 5 — Open N in a grid (headline feature)

- [x] **5.1 Selection model**
  - Checkboxes add/remove `MatchBlock` ids; action bar shows live count,
    "Open N in grid" (enabled ≥1), "Select all", "Clear".
  - AC: selecting/deselecting updates the count and button state.
- [x] **5.2 Layout function**
  - `src/grid/layout.ts`: `layout(n, max)` → `EditorGroupLayout` tree
    (1,2→1×2,3→1×3,4→2×2,5-6→2×3,7-9→3×3), cap at `maxGridEditors`.
  - AC: unit tests for n = 1..9 produce the expected group trees.
- [x] **5.3 Apply layout + reveal each**
  - `src/grid/gridService.ts`: `setEditorLayout`, then for each selected
    match open in its target `ViewColumn` with `preview:false`, select +
    `revealRange(InCenter)`.
  - AC: selecting 4 matches opens a 2×2 grid, each editor centered on its
    match; same file twice opens two independent editors.
- [x] **5.4 Independent navigation + over-cap handling**
  - Confirm each editor scrolls independently (default; no sync). If
    selection > `maxGridEditors`, warn and open the first N.
  - AC: scrolling one grid editor leaves the others put; over-cap shows a
    warning toast.

## Phase 6 — Settings, polish, robustness

- [x] **6.1 Configuration**
  - Contribute `defaultContextLines`, `maxGridEditors`, `maxResults`,
    `useSmartCase`, `ripgrepPath`; read in services.
  - AC: changing a setting affects the next search/grid open.
- [x] **6.2 UX polish**
  - Codicons for toggles, keyboard nav between matches (next/prev), loading
    indicator, result counts per file/total.
  - AC: keyboard-only flow: focus → type → navigate → open grid.
  - Keyboard: ↑/↓ move the active match, Enter opens it, Space toggles its
    grid selection. Spinner shows while searching; per-file match counts and a
    total/truncated status line are shown.
- [x] **6.3 Multi-root & no-workspace**
  - Handle multiple workspace folders (search each / pick) and the
    no-folder-open case gracefully.
  - AC: multi-root workspace returns results from all folders; no crash
    with no folder open.

## Phase 7 — Tests, docs, packaging

- [x] **7.1 Unit tests green in CI**
  - Cover arg builder, JSON parser, layout function; add GitHub Actions
    workflow running `lint` + `test` + `build`.
  - AC: CI passes on push/PR.
- [x] **7.2 Integration smoke test**
  - `@vscode/test-electron` test: activate, run a search on a fixture
    workspace, assert a non-empty `SearchModel`.
  - AC: integration test passes locally and in CI.
- [x] **7.3 README + media**
  - Usage docs, animated GIF/screenshot of grid open, marketplace metadata
    (`categories`, `keywords`, `galleryBanner`).
  - AC: README renders with a working demo image.
- [x] **7.4 Package**
  - `vsce package` → `.vsix`; manual install + smoke test in clean VS Code.
  - AC: `.vsix` installs and the full find → grid flow works end-to-end.

---

## First slice (recommended starting point)

To reach a visible, demoable result fastest, do **0.1–0.4 → 1.1–1.3 →
2.1–2.4 → 3.1–3.3 → 5.2–5.3**. That yields: an Activity Bar finder that
searches with context lines and opens selected matches in a grid — the core
idea — before layering polish (Phase 4 reveal, Phase 6 settings, Phase 7
packaging).
