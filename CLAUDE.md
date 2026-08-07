# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Grep Finder is a VS Code extension: a sidebar webview that runs ripgrep over the workspace and opens results in a grid.

## Commands

- `npm run build` — `node esbuild.js`; bundles `src/extension.ts` → `dist/extension.js` (node18/cjs, `vscode` external) and `media/main.ts` → `media/main.js` (browser/iife). Also copies codicons into `media/codicons/`, which is gitignored and only exists after a build.
- `npm run watch` — same with `--watch`. Changes need **Developer: Reload Window** in the Extension Development Host.
- `npm run lint` — `eslint src --ext ts`. Covers `src` only, not `test/` or `media/`.
- `npm test` — `node --test --import tsx test/*.test.ts`. `node:test` + `node:assert/strict`, no VS Code, no mocha. The glob is non-recursive, which is what keeps `test/integration/` out.
  - Single file: `node --test --import tsx test/layout.test.ts`
  - Single test: `node --test --import tsx --test-name-pattern "fixed string by default" test/args.test.ts`
- `npm run test:integration` — builds, compiles `tsconfig.integration.json` → `out/`, then downloads VS Code and runs mocha against it with `examples/` as the workspace. Ordering is required; don't skip the build. Headless Linux needs `xvfb-run -a`. There is no CLI flag to filter these — mocha options are inline in `test/integration/suite/index.ts`.
- `npm run package` — build + `npx @vscode/vsce package --no-update-package-json`.

## Hard rule: zero runtime deps, no network

The extension must make no network calls of any kind, and this is enforced.

- `dependencies` in `package.json` stays `{}`. Everything is a devDependency. Do not add a runtime dependency.
- Never introduce `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `http`/`https`, `net`, `dns`, `tls`, `axios`, or `node-fetch`. CI greps the built bundles (`dist/extension.js`, `media/main.js`) for these and **fails the build**.
- The webview CSP must keep `default-src 'none'`, `connect-src 'none'`, `img-src 'none'`, `frame-src 'none'`, and a nonce-based `script-src`.
- Import Node builtins with the `node:` prefix (`node:fs`, `node:path`, `node:child_process`) — the SECURITY.md verification grep depends on that form.
- ripgrep is spawned with an argv array, never a shell string.

See `SECURITY.md`.

## Architecture boundary

The webview and extension host talk over `postMessage` only. All VS Code API use stays on the host side (`src/`); `media/main.ts` is DOM-only. Pure logic lives in `src/search/` and `src/grid/` so it stays unit-testable without VS Code — keep new logic there rather than in `searchViewProvider.ts`.

## Style

No prettier or `.editorconfig`; follow the surrounding code (2-space indent, single quotes, semicolons, trailing commas).

- tsconfig is stricter than default: `strict`, plus `noUnusedLocals` and `noUnusedParameters`. Unused function args must be `_`-prefixed (the one ESLint override). `tsconfig.integration.json` deliberately relaxes both.
- ESLint uses the legacy `.eslintrc.json` format, not flat config.

## Gotchas

- `activationEvents` is `[]` — activation is implicit from the contributed webview view (`grepFinder.searchView`) and the `grepFinder.focus` command. `docs/DESIGN.md` still describes `onView:` events; the manifest is the source of truth.
- `src/search/rgLocate.ts` probes several ripgrep locations (`@vscode/ripgrep-universal` for VS Code 1.122+, `@vscode/ripgrep`, legacy `vscode-ripgrep`, `node_modules.asar.unpacked`, then `rg` on PATH). New VS Code layouts break here first.
- Workspace trust: `grepFinder.ripgrepPath` is in `restrictedConfigurations`, so a workspace-supplied rg path is ignored in untrusted workspaces.
- The integration suite activates the extension by id `RobertoRiquelmeSaez.grep-finder`; renaming publisher or name breaks it.
- `.vscodeignore` excludes all sources and re-includes `!dist/**`. New shipped assets must be added there deliberately.
- `docs/TASKS.md` is a historical planning artifact, not a live task list.

## Release

Releasing is automated by `.github/workflows/auto-release.yml`, which runs after CI succeeds on `main`. **Do not hand-bump `version` in `package.json`** — the workflow does it, and a hand-edit is not itself a release, so the next automated run just bumps past it. To pin a specific number, dispatch **Auto Release** with the `version` input (bare `X.Y.Z`); it overrides the level and implies force.

To ship work: add bullets under `## [Unreleased]` in `CHANGELOG.md` and push to `main`. Those bullets become the release notes and the heading is rewritten to the new version.

Commit **subject line** controls: `#minor` / `#major` change the bump level (patch otherwise) and are honoured across every commit since the last tag; `[skip release]` on the tip commit suppresses that release. A release is skipped entirely unless `src/`, `media/`, or `package.json` changed since the last `v*` tag.

Markers are matched in subjects only, never bodies, and must stand alone. This matters when writing commit messages *about* the release system: a body that merely mentions `#major` used to be obeyed, which cut a spurious `1.0.0`. Don't relax this back to `%B`.

`scripts/prepare-release.js` does the changelog rewrite and is runnable by hand: `node scripts/prepare-release.js 0.1.1 notes.md [fallback.md]`.

Every `vsce` invocation passes `--no-update-package-json`; versioning is never delegated to vsce.

Two `GITHUB_TOKEN` consequences to keep in mind — neither is a bug to fix:

- The bump commit and tag are pushed with `GITHUB_TOKEN`, so they start no new workflow runs. That is what prevents a release loop, and it is why auto-release creates the GitHub Release itself instead of relying on `release.yml`.
- `publish.yml` is therefore never triggered automatically. Marketplace publishing stays a manual dispatch from the Actions tab.

`release.yml` still handles hand-pushed `v*` tags and fails if the tag doesn't match `package.json`. Don't reuse a tag.

## Repo etiquette

Work on `main`. Commit subjects are short, imperative, sentence-case, with no Conventional Commits prefixes (e.g. `Point repository URLs at the renamed grep-finder-vs-code repo`).
