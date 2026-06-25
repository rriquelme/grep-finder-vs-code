# Changelog

All notable changes to **Enhanced Finder** are documented here.

## [0.0.11]
- Security: documented and certified that the extension makes **no network
  connections** (see `SECURITY.md`), and tightened the webview CSP with explicit
  `connect-src 'none'` / `img-src 'none'` / `frame-src 'none'`.

## [0.0.10]
- Marketplace readiness: added an extension icon, `CHANGELOG.md`, a license
  disclaimer, workspace-trust capability (a workspace-defined `ripgrepPath` is
  ignored in untrusted workspaces), and a gated publish workflow.

## [0.0.9]
- Selecting the search box now highlights the existing query so you can retype immediately.

## [0.0.8]
- Per-file collapse chevrons and a collapse-all / expand-all button to show only file titles.

## [0.0.7]
- Fixed confusing case matching: "Match case" off is now always case-insensitive
  (removed ripgrep smart-case, which silently became case-sensitive when the
  query contained an uppercase letter). Clearer active state on the toggle buttons.

## [0.0.6]
- Instant selection (removed the click delay); clicking only toggles the selection ring.

## [0.0.5]
- Click a result to select it (rounded highlight) instead of a checkbox; double-click opens.
- Context fields gray out instead of locking: clicking Before/After vs Both switches
  which group is used without resetting values.

## [0.0.4]
- Result line numbers stay in sync when you edit a file (live shift while typing,
  full re-search on save).

## [0.0.3]
- Fixed the search box losing focus while typing (the form no longer rebuilds on
  each result). Only the results list scrolls; the panel resizes.

## [0.0.2]
- Fixed ripgrep discovery for VS Code 1.122+ (`@vscode/ripgrep-universal`); errors
  are now surfaced and logged to the "Enhanced Finder" output channel.

## [0.0.1]
- Initial release: Activity Bar finder powered by ripgrep, grep-style `-A`/`-B`/`-C`
  context, grouped results with highlights, single-open, keyboard navigation, and
  "Open in grid" — open multiple matches tiled, each scrolled to its match and
  navigated independently.
