# Grep Finder for VS Code

Search your workspace like `grep`, then **open several matches side-by-side** —
each editor scrolled to its own match and scrollable independently.

It lives in the Activity Bar (the icon strip on the left, next to Explorer and
Search) and runs on the **ripgrep that VS Code already ships with**.

> **Fully offline. No installer. No network access of any kind.**
> There is no separate binary to download, no bundled search engine, no
> telemetry, no update check — the extension is a UI over the finder that is
> already inside your editor. Works on an air-gapped machine, and your code never
> leaves it. See [No internet, by design](#no-internet-by-design).

---

## Why use it instead of the built-in Search

| | Built-in Search | Grep Finder |
|---|---|---|
| Context around a match | fixed, a line or two | any number of lines, `-A` / `-B` / `-C` like grep |
| Comparing matches across files | open them one at a time, scroll each by hand | tick N matches → **one click** tiles them, each already at its match |
| Two regions of the *same* file | not possible in one view | select both matches → two panes of that file, each at a different line |

If you've ever run `rg -C 5 someFunction` and then wished you could click the
results open, that's this extension.

---

## Getting started

1. Install it (see [Install](#install)) and reload VS Code.
2. Open a folder or workspace.
3. Click the **Grep Finder** icon in the Activity Bar — or press
   <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>F</kbd> (<kbd>Cmd</kbd>+<kbd>Alt</kbd>+<kbd>F</kbd> on macOS).
4. Type a query. Results appear as you type, grouped by file.

### The search box

Three toggles sit inside the search field, just like VS Code's own search.
Focusing the box selects whatever is already there, so you can retype straight away.

- **Match case** — off is case-insensitive, on is exact case. It's a plain on/off
  switch: no smart-case surprise where one capital letter silently changes results.
- **Match whole word** — `-w`; `total` no longer matches `subtotal`.
- **Use regular expression** — off searches your text literally (so `a.b` means
  `a.b`), on treats it as a regex.

### Context lines (the grep part)

Below the query are three number fields:

- **Before (-B)** — lines shown above each match
- **After (-A)** — lines shown below each match
- **Both (-C)** — the same number above and below

Only one *group* is active at a time: **Before/After**, or **Both**. Click into a
field to activate its group — the other grays out but keeps its numbers, so you can
flip between "5 lines of leading context" and "2 either side" without retyping.
A hint under the fields always says which group is in effect.

### Scoping the search

- **files to include** — e.g. `src/**/*.ts`, or several separated by commas:
  `src/**/*.ts, test/**/*.ts`
- **files to exclude** — e.g. `**/node_modules/**, **/*.min.js`

Files ignored by your `.gitignore` are skipped, exactly like ripgrep on the
command line.

### Working with results

Each result block shows the match line (highlighted) plus its context lines, with
real line numbers.

- **Click** a block to **select** it (it gets a rounded highlight).
- **Double-click** a block to **open** the file at that line.
- **Click a file header** — or its chevron — to collapse/expand that file's results.
- The **collapse/expand-all** button in the results bar folds every file at once,
  useful when a query hits 30 files and you want to scan the file list first.
- Result line numbers **follow your edits**: type above a match and its number
  shifts with it; on save the search re-runs so everything is exact again.
- The status line reports how many matches in how many files, and says
  `(truncated)` if you hit the result cap.

### Keyboard

| Key | Action |
|---|---|
| <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>Alt</kbd>+<kbd>F</kbd> | Focus the Grep Finder view |
| <kbd>↑</kbd> / <kbd>↓</kbd> | Move between match lines |
| <kbd>Enter</kbd> | Open the active match |
| <kbd>Space</kbd> | Select / deselect the active match for opening |

(Arrow keys navigate whenever focus is outside a text field.)

### Open matches in a grid

This is the feature the extension exists for.

1. Select the matches you care about — click them, or press <kbd>Space</kbd> on
   each while moving with the arrow keys.
2. Click **Open N in grid** in the results bar.

VS Code splits the editor area and opens every selected match in its own pane,
centered on its match line. Each pane is a real editor, so you can scroll, edit,
and navigate them **independently** — including two panes of the *same* file
showing two different regions.

Layouts follow the count: 2 → side by side, 3 → 3-up, 4 → 2×2, 5–6 → 2×3,
7–9 → 3×3. The cap is configurable (`grepFinder.maxGridEditors`, default 9).

**Try it:** search `calculateInvoiceTotal`, set **Both (-C)** to `2`, select a
match in four different files, and press **Open 4 in grid** — four panes, each
parked on its own copy of that function.

### …or open them as tabs

A grid is great for comparing a handful of matches side by side, and wrong when
you just want to walk through twenty hits without losing the split layout you
already had. The two small buttons left of the Open button switch between them:

| | Mode | What happens |
|---|---|---|
| ⊟ | **grid** | Retiles the editor area, one pane per selected match (the default). |
| 🗐 | **tabs** | Opens the selection as ordinary tabs in the **active** editor group. Your layout is left exactly as it was. |

In tabs mode each tab is still centered on its match, and you land on the first
one. A file can only have one tab, so selecting several matches in the same file
opens it once, at the top-most of them — pick grid mode when you want to see two
regions of one file at the same time.

The button label tells you which mode you are in (**Open 4 in tabs**), the choice
is remembered, and `grepFinder.openMode` sets which one you start in. Tabs have
their own cap, `grepFinder.maxTabEditors` (default 20).

---

## Install

**From a release (recommended)**

Download `grep-finder-<version>.vsix` from the
[GitHub Releases](https://github.com/rriquelme/grep-finder-vs-code/releases)
page — one file works on every platform — then either:

- In VS Code: **Extensions** view → `…` menu → **Install from VSIX…**, or
- From a terminal:
  ```bash
  code --install-extension grep-finder-<version>.vsix
  ```

Reload VS Code when prompted. Nothing else is downloaded — no post-install step,
no companion binary, no account.

**From source** — see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

---

## Settings

Search for `grepFinder` in Settings, or edit `settings.json`:

| Setting | Default | What it does |
|---|---|---|
| `grepFinder.defaultContextLines` | `2` | Value **Both (-C)** starts at the first time you open the view. |
| `grepFinder.maxGridEditors` | `9` | Most editors opened at once by **Open in grid**. Extra selections are ignored. |
| `grepFinder.maxResults` | `2000` | Matches collected per search before results are truncated. |
| `grepFinder.maxTabEditors` | `20` | Most tabs opened at once by **Open in tabs**, counted per file. Extra selections are ignored. |
| `grepFinder.openMode` | `"grid"` | Which mode the Open button starts in, `"grid"` or `"tabs"`. The in-panel toggle overrides it from then on. |
| `grepFinder.ripgrepPath` | `""` | Absolute path to your own `rg` binary. Empty uses the one bundled with VS Code, falling back to `rg` on your `PATH`. Ignored in untrusted workspaces. |

---

## Requirements

VS Code **1.85** or newer. Nothing else — ripgrep comes with VS Code.

---

## Privacy & security

### No internet, by design

**Grep Finder makes no network requests of any kind.** No telemetry, no
analytics, no update checks, no remote code, no crash reporting. Your source code,
your queries, and your file names never leave your machine — so it is safe to use
on private, proprietary, or air-gapped codebases.

- **Nothing to install beyond the extension.** It shells out to the ripgrep that
  is already part of your VS Code installation, so there is no downloader, no
  bundled search binary, and no first-run setup.
- **No runtime dependencies.** The packaged extension ships only its own compiled
  code and the codicon font (`"dependencies": {}`).
- **The results UI can't reach the network either.** The webview runs under a
  strict Content Security Policy including `connect-src 'none'`, which blocks
  `fetch`, `XMLHttpRequest`, and `WebSocket` outright.
- **Read-only.** It reads files to search and opens them in the editor; it never
  writes to your files.
- **No shell.** ripgrep is launched with an argument array, never a shell string,
  so search text can't be interpreted as a command.
- **Workspace trust.** Search works in untrusted workspaces, but a
  workspace-supplied `grepFinder.ripgrepPath` is ignored there, so an
  untrusted folder can't point the extension at an arbitrary executable.

Don't take our word for it — [`SECURITY.md`](SECURITY.md) lists the exact
commands to verify all of this yourself against a checkout or an unzipped
`.vsix`. CI runs that same check on every push.

---

## Troubleshooting

**"Open a folder to search."** — the extension searches workspace folders, so open
a folder or workspace first.

**Could not find ripgrep / search errors** — VS Code has moved its bundled ripgrep
around across versions. Set `grepFinder.ripgrepPath` to an `rg` binary on your
machine (`which rg` / `where rg`) and search again. Details are logged to the
**Grep Finder** output channel.

**Results say "(truncated)"** — you hit `grepFinder.maxResults`. Narrow the
query, add an include glob, or raise the setting.

**A file I expected is missing** — it's probably in `.gitignore`, or excluded by
your **files to exclude** globs.

## Known limitations

- Binary files are skipped (ripgrep's default).
- Grid opening is capped at 9 editors; beyond that the panes are too small to be useful.
- The results panel is read-only — edit in the opened editors, not in the panel.

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## Contributing & internals

- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — build, test, debug, release.
- [docs/DESIGN.md](docs/DESIGN.md) — architecture.
- [docs/TASKS.md](docs/TASKS.md) — phase-by-phase task list.
- [examples/README.md](examples/README.md) — sample workspace with a guided walkthrough.

Built with TypeScript, the VS Code Extension API, ripgrep (`--json`), esbuild, and
a plain webview UI.

## License & disclaimer

Released under the [MIT License](LICENSE) — free and open source.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED. To the maximum extent permitted by law, the authors and contributors are
**not liable** for any claim, damages, data loss, or other liability arising from
the use of this software. You use it **at your own risk**. "VS Code" and "Visual
Studio Code" are trademarks of Microsoft; this is an independent, unaffiliated
project. ripgrep is © its authors under the MIT/Unlicense terms.
