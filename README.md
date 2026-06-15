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

📐 **Planning.** This repository currently contains the design and roadmap.
See [`docs/DESIGN.md`](docs/DESIGN.md) for the architecture and
[`docs/TASKS.md`](docs/TASKS.md) for the actionable, phase-by-phase task list.

## Core features (planned)

- Activity Bar container with its own icon and search view.
- Find across the workspace like a normal find (case sensitivity, whole
  word, regex, include/exclude globs).
- Context-line controls: `-A N`, `-B N`, `-C N` (after / before / both).
- Results grouped by file with rendered context lines and highlighted matches.
- Single-click "open at match" reveal.
- Multi-select matches → "Open in grid" (2×2, 3-up, etc.), each revealed at
  its match line and independently navigable.

## Tech

TypeScript · VS Code Extension API · ripgrep (`--json`) · esbuild · Webview UI.
