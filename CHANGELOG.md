# Changelog

All notable changes to **Grep Finder** are documented here.

## [0.1.0]

First release under the name **Grep Finder**, and the first one prepared for the
VS Code Marketplace. Everything below was developed as 0.0.12 but never shipped
under that number.

- **Renamed to Grep Finder** (was "Enhanced Finder") ahead of the first
  Marketplace release, so the name matches what people actually search for.
  This renames the extension id (`grep-finder`), the publisher
  (`RobertoRiquelmeSaez`), the view and command ids, and the settings prefix:
  `enhancedFinder.*` → `grepFinder.*`. Nothing had been published yet, so no
  installed extension or existing setting is affected.
- Docs rewritten around day-to-day use in VS Code: the extension page is now a
  task-oriented guide (search options, context lines, results, keyboard, grid),
  and leads with the fact that the extension works **fully offline** with no
  installer and no network access. Contributor material moved to
  `docs/DEVELOPMENT.md`.
- `main` is now the repository's default branch; CI and Release workflows updated
  to match.
- CI now fails the build if a networking API ever appears in the shipped bundles,
  enforcing the guarantee documented in `SECURITY.md`.
- Release workflow lints and tests before packaging, and refuses to publish when
  the pushed tag does not match the version in `package.json`.
- Fixed the Publish workflow: `secrets` cannot be used in a step-level `if`, so
  the token checks are done through job-level env vars (previously the workflow
  would fail to run at all).
- Both workflows package with `@vscode/vsce` (Release was still invoking the
  deprecated `vsce` package) and `--no-update-package-json`.

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
  are now surfaced and logged to the "Grep Finder" output channel.

## [0.0.1]
- Initial release: Activity Bar finder powered by ripgrep, grep-style `-A`/`-B`/`-C`
  context, grouped results with highlights, single-open, keyboard navigation, and
  "Open in grid" — open multiple matches tiled, each scrolled to its match and
  navigated independently.
