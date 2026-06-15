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

Grab the `.vsix` for your platform from the
[**GitHub Releases**](../../releases) page, then install it:

- VS Code: Extensions view → `…` menu → **Install from VSIX…**, or
- `code --install-extension enhanced-finder-<version>-<platform>.vsix`

Platform files: `linux-x64`, `win32-x64`, `darwin-x64` (macOS Intel),
`darwin-arm64` (macOS Apple Silicon). Each bundles the matching ripgrep binary.

> Releases are produced automatically: push a tag like `v0.0.1` (or run the
> **Release** workflow from the Actions tab) and CI builds all four platform
> `.vsix` files and attaches them to a single GitHub Release.

Then open a folder (try this repo so you get the `examples/`), click the
**Enhanced Finder** icon in the Activity Bar, and search.

> If your platform isn't published, run from source (Option B, which downloads
> the matching ripgrep) or point `enhancedFinder.ripgrepPath` at your own `rg`.

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
2. Set context lines: **Before (-B)**, **After (-A)**, or **Both (-C)** — `-C`
   overrides the other two, like grep.
3. Results are grouped by file with context lines and highlighted matches.
   - **Click** a match to open it at that line.
   - **↑/↓** move the active match, **Enter** opens it, **Space** ticks it for
     the grid.
4. Tick several matches and press **Open N in grid** to tile them (2×2, 3-up,
   3×3…). Each opens scrolled to its match and scrolls **independently** —
   select two matches in one file to compare two regions of it.

## Features

- Activity Bar container with its own icon and search view.
- Find across the workspace like a normal find (case sensitivity, whole
  word, regex, include/exclude globs), powered by ripgrep.
- Context-line controls: `-A N`, `-B N`, `-C N` (after / before / both).
- Results grouped by file with rendered context lines and highlighted matches.
- Single-click "open at match" reveal; full keyboard navigation.
- Multi-select matches → "Open in grid" (2×2, 3-up, etc.), each revealed at
  its match line and independently navigable.
- Multi-root workspace aware; configurable via `enhancedFinder.*` settings.

## Tech

TypeScript · VS Code Extension API · ripgrep (`--json`) · esbuild · Webview UI.
