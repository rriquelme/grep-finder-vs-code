# Development

Everything needed to build, run, test, and release Grep Finder.
For what the extension *does*, see the [README](../README.md); for how it's put
together, see [DESIGN.md](DESIGN.md); for the no-network guarantee and how to
verify it, see [SECURITY.md](../SECURITY.md).

## Prerequisites

- Node.js 20 (what CI uses)
- VS Code 1.85+

## Setup

```bash
npm install
npm run build      # bundle extension + webview, copy codicons into media/
```

## Run it

Open this repo in VS Code and press <kbd>F5</kbd>. That launches an Extension
Development Host with the extension loaded. Click the **Grep Finder** icon in
its Activity Bar and search — the `examples/` folder is full of files that
deliberately share tokens across nested directories, so it's a good target. See
[examples/README.md](../examples/README.md) for a guided walkthrough.

`npm run watch` rebuilds on change; reload the dev host window
(**Developer: Reload Window**) to pick up changes.

## Scripts

| Command | What it does |
|---|---|
| `npm run build` | Bundle extension + webview with esbuild |
| `npm run watch` | Same, in watch mode |
| `npm run lint` | ESLint over `src` |
| `npm test` | Unit tests (rg args, JSON parser, line shifting, grid layout) |
| `npm run test:integration` | Builds, compiles, then runs tests in a real VS Code instance |
| `npm run gen-icon` | Regenerate `media/icon.png` (marketplace icon) from source |
| `npm run package` | Produce `grep-finder-<version>.vsix` |

Unit tests run on `node --test` via `tsx` and need no VS Code. Integration tests
download a VS Code build through `@vscode/test-electron`; on Linux CI they run
under `xvfb-run`.

## Layout

```
src/
  extension.ts              activation, command + view registration
  models.ts                 shared types (SearchOptions, SearchModel, …)
  search/
    args.ts                 SearchOptions  -> ripgrep argv
    rgJsonParser.ts         ripgrep --json -> match blocks
    rgLocate.ts             find the ripgrep binary VS Code ships
    lineShift.ts            keep result line numbers correct while editing
    searchService.ts        spawn ripgrep, stream partial results
  grid/
    layout.ts               N matches -> EditorGroupLayout (pure, unit-tested)
    gridService.ts          apply the layout and reveal each match
  view/
    searchViewProvider.ts   webview host, message routing, CSP
media/
  main.ts / main.css        webview UI (bundled to media/main.js)
  icon.svg / icon.png       Activity Bar icon / marketplace icon
scripts/
  gen-icon.js               renders icon.png
```

The webview and the extension host talk over `postMessage` only; all VS Code API
use stays on the host side. Pure logic lives in `search/` and `grid/` so it can be
unit-tested without VS Code.

### Keep it offline

The no-network promise in [SECURITY.md](../SECURITY.md) is a hard constraint, not
a preference: no runtime `dependencies`, no networking APIs, and the webview CSP
keeps `connect-src 'none'`. CI greps the built bundles for networking APIs and
fails the build if any appear — if you need a new capability, find a local way to
do it.

## CI

`.github/workflows/ci.yml` runs on pushes to `main` and on pull requests: install
→ lint → unit tests → build → integration tests (headless) → package a `.vsix` →
verify no networking APIs in the bundles. The `.vsix` is uploaded as a build
artifact. Packaging runs on every push so a broken manifest surfaces immediately
rather than at release time.

A successful CI run on `main` is also what triggers Auto Release (see below), so a
release is only ever built from a commit that already passed every check.

## Releasing

Releases are automatic. `.github/workflows/auto-release.yml` runs after CI passes
on `main` and, when there is something to ship, bumps the version, updates the
changelog, tags, and publishes a GitHub Release with the `.vsix` attached.

Day to day that means: **write your changes under `## [Unreleased]` in
[CHANGELOG.md](../CHANGELOG.md), then push to `main`.** Those bullets become the
release notes, and the heading is rewritten to the new version number for you. If
there is no `## [Unreleased]` section, the commit subjects since the last tag are
used instead.

What you control from a commit **subject line**:

| Want | Put in the commit subject |
| --- | --- |
| Patch bump (`0.1.0` → `0.1.1`) | nothing — this is the default |
| Minor bump (`0.1.0` → `0.2.0`) | `#minor` |
| Major bump (`0.1.0` → `1.0.0`) | `#major` |
| No release for this push | `[skip release]` |

Markers are read from subject lines only, never from commit bodies. Bodies are
prose, and prose that merely *mentions* a marker would otherwise be obeyed — the
first run of this workflow cut a `1.0.0` because the commit body introducing it
contained the words "`#minor` or `#major`". A marker must also stand alone, so
`#majority` does not trigger a major bump.

A release is only cut when something under `src/`, `media/`, or `package.json`
changed since the last `v*` tag, so doc, CI, and test-only commits do not burn a
version. `#minor` and `#major` are looked for across every commit since that tag,
so the marker still counts if you push more commits before a release happens;
`[skip release]` only applies to the commit at the tip.

The bump commit is pushed with `GITHUB_TOKEN`, and GitHub does not start workflow
runs from those, so this cannot loop back into CI.

**Manual releases** still work. Run **Auto Release** from the Actions tab to pick
the bump level explicitly, or to force a release when no shipped files changed.
Pushing a `v*` tag by hand triggers `.github/workflows/release.yml`, which builds
and releases whatever `package.json` says (failing if tag and version disagree).

Version tags are the source of truth for what shipped — don't reuse one.

## Publishing to the Marketplace

`.github/workflows/publish.yml` publishes to the VS Code Marketplace and,
optionally, Open VSX. Each step is skipped unless its token secret exists, so the
workflow is harmless until you configure it:

1. Create a Marketplace publisher and set `publisher` in `package.json` to it.
2. Create an Azure DevOps PAT with **Marketplace → Manage**.
3. Add it as the repo secret `VSCE_PAT` (and optionally `OVSX_TOKEN` for Open VSX).
4. Run **Publish** from the Actions tab.

GitHub does not re-trigger workflows for releases created with `GITHUB_TOKEN`, so
neither Auto Release nor Release kicks off Publish — run it yourself. Reaching
users is always a deliberate step, even though cutting a release is automatic.
