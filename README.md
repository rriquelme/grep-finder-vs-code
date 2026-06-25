# Enhanced Finder for VS Code

A VS Code extension that lives in the Activity Bar (the left-hand icon
strip, alongside Explorer, Search, Source Control, etc.) and gives you a
**grep-style multi-file finder** with context lines and the ability to
**open several matches side-by-side**, each scrolled to the exact match
and navigable independently.

## Why

VS Code's built-in Search is great for finding text, but:

- It shows only a couple of context lines per match and you can't control
  them like `grep -A` / `-B` / `-C`.
- When you want to compare the *same* region across several files, you end
  up opening files one by one and scrolling each to the right spot by hand.

Enhanced Finder fixes both:

1. **grep-style context** — choose how many lines to show **A**fter, **B**efore,
   or both (**C**) around every match, right in the results panel.
2. **Open matches in a grid** — pick N matches (e.g. 4) and open them in a
   tiled editor layout. Each file opens scrolled to its match, and because
   each is its own editor you can scroll/navigate every one independently.

## Status

✅ **Feature-complete & packaged.** The extension scaffolds, registers its
Activity Bar view, searches via ripgrep with grep-style context across
multi-root workspaces, renders grouped results, opens a single match, and opens
selected matches in an independently-navigable grid. It builds, lints, passes
unit + integration tests, and packages to a `.vsix`. See
[`docs/DESIGN.md`](docs/DESIGN.md) for the architecture and
[`docs/TASKS.md`](docs/TASKS.md) for the phase-by-phase task list / progress.

## Install & test

**Option A — download a release (recommended)**

Grab `enhanced-finder-<version>.vsix` from the
[**GitHub Releases**](../../releases) page — one file works on **all
platforms** — then install it:

- VS Code: Extensions view → `…` menu → **Install from VSIX…**, or
- `code --install-extension enhanced-finder-<version>.vsix`

> Releases are produced automatically: push a tag like `v0.0.1` (or run the
> **Release** workflow from the Actions tab) and CI builds the `.vsix` and
> attaches it to a GitHub Release.

Then open a folder (try this repo so you get the `examples/`), click the
**Enhanced Finder** icon in the Activity Bar, and search.

> **ripgrep:** the extension uses the ripgrep that VS Code already ships, so
> nothing extra to install. To use a different one, set
> `enhancedFinder.ripgrepPath`.

**Option B — run from source**

```bash
npm install
npm run build      # bundle extension + webview, copy codicons
npm test           # unit tests (args, ripgrep parser, grid layout)
npm run lint
npm run package    # produce a .vsix
```

Then press **F5** to launch an Extension Development Host, open the
**Enhanced Finder** icon in the Activity Bar, and search. The `examples/`
folder contains files across nested folders that share search words — see
[`examples/README.md`](examples/README.md) for a guided test.

## Usage

1. Type a query. Toggle **case** / **whole word** / **regex** with the buttons.
   "Match case" off is always case-insensitive.
2. Set context lines: **Before (-B)**, **After (-A)**, or **Both (-C)**.
   Clicking into one group makes it active and grays out the other (values are
   kept, not reset).
3. Results are grouped by file with context lines and highlighted matches.
   - **Click** a result to select it (rounded highlight); **double-click** opens
     it at that line. Collapse a file with its chevron, or collapse all.
   - **↑/↓** move the active match, **Enter** opens it, **Space** selects it.
4. Select several matches and press **Open N in grid** to tile them (2×2, 3-up,
   3×3…). Each opens scrolled to its match and scrolls **independently** —
   select two matches in one file to compare two regions of it.

## Features

- Activity Bar container with its own icon and search view.
- Find across the workspace like a normal find (case sensitivity, whole
  word, regex, include/exclude globs), powered by ripgrep.
- Context-line controls: `-A N`, `-B N`, `-C N` (after / before / both).
- Results grouped by file with context lines and highlighted matches;
  per-file and collapse-all minimize.
- Click-to-select, double-click to open; full keyboard navigation.
- Result positions stay in sync as you edit files.
- Multi-select matches → "Open in grid" (2×2, 3-up, etc.), each revealed at
  its match line and independently navigable.
- Multi-root workspace aware; configurable via `enhancedFinder.*` settings.

## Settings

- `enhancedFinder.defaultContextLines` — default context lines (default `2`).
- `enhancedFinder.maxGridEditors` — max editors opened by "Open in grid" (default `9`).
- `enhancedFinder.maxResults` — match cap per search before truncating (default `2000`).
- `enhancedFinder.ripgrepPath` — optional path to your own `rg`. For safety this is
  ignored in **untrusted** workspaces.

## Privacy & security

- **Local only.** All searching runs locally via ripgrep. The extension makes
  **no network requests** and collects **no telemetry**.
- **No runtime dependencies.** The packaged extension bundles only its own code
  and the codicon font — no third-party runtime npm packages.
- **Read-only.** It reads files to search and opens them in the editor; it never
  writes to your files.
- **Workspace trust.** Searching works in untrusted workspaces, but a
  workspace-supplied `enhancedFinder.ripgrepPath` is ignored there so an untrusted
  folder can't point the extension at an arbitrary executable.

## Tech

TypeScript · VS Code Extension API · ripgrep (`--json`) · esbuild · Webview UI.

## License & disclaimer

Released under the [MIT License](LICENSE) — free and open source.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED. To the maximum extent permitted by law, the authors and contributors
are **not liable** for any claim, damages, data loss, or other liability arising
from the use of this software. You use it **at your own risk**. "VS Code" and
"Visual Studio Code" are trademarks of Microsoft; this is an independent,
unaffiliated project. ripgrep is © its authors under the MIT/Unlicense terms.
