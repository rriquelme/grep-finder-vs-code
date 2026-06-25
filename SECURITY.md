# Security & Privacy

## No network — by design

**Enhanced Finder does not communicate with the internet in any way.** It is a
local visual finder: it shells out to the **ripgrep that ships with your VS Code
installation** to search your files, and renders the results. There is no
telemetry, no analytics, no update check, no "phone home", and no remote code.

### What it actually uses

The packaged extension contains only its own compiled code plus the codicon
icon font. It has **zero third-party runtime dependencies**
(`"dependencies": {}` in `package.json`). The only platform APIs it calls are:

| API | Why |
|-----|-----|
| `vscode` | The editor extension API (views, editors, settings, workspace trust). |
| `node:child_process` (`spawn`) | Launch `ripgrep` to perform the search. |
| `node:fs` | Locate the ripgrep binary and check it exists (read-only). |
| `node:path` | Build file paths. |

There are **no** uses of `fetch`, `http`/`https`, `net`, `dns`, `tls`,
`WebSocket`, `XMLHttpRequest`, `EventSource`, or any HTTP client library.

### The webview cannot reach the network either

The results UI runs in a VS Code webview locked down with a strict Content
Security Policy:

```
default-src 'none'; connect-src 'none'; img-src 'none'; frame-src 'none';
style-src <webview>; script-src 'nonce-…'; font-src <webview>
```

`connect-src 'none'` blocks `fetch`/`XMLHttpRequest`/`WebSocket`, and scripts run
only from the bundled file via a per-load nonce. The webview can load only the
extension's own `media/` assets.

## Verify it yourself

From a checkout (or after unzipping the `.vsix`, whose payload is under
`extension/`):

```bash
# 1. No third-party runtime deps:
node -p "require('./package.json').dependencies"        # -> {}

# 2. No networking APIs in the shipped bundles:
grep -nE "fetch\(|XMLHttpRequest|WebSocket|EventSource|require\(['\"](https?|net|dns|tls)['\"]\)|axios|node-fetch" \
  dist/extension.js media/main.js                        # -> no matches

# 3. The only Node builtins used by the extension host:
grep -oE "require\(\"node:[a-z]+\"\)" dist/extension.js | sort -u
#   node:child_process, node:fs, node:path   (+ "vscode")
```

You can also confirm at runtime with any network monitor (e.g. Little Snitch,
`lsof -i`, or VS Code's process explorer): the extension opens no sockets — only
short-lived `rg` child processes that read local files.

## Other hardening

- **Read-only:** the extension reads files to search and opens them in the
  editor; it never writes to your files.
- **No shell:** ripgrep is launched with an argument array (`spawn`), not a shell
  string, so search text cannot be interpreted as a command.
- **Workspace trust:** in untrusted workspaces a workspace-supplied
  `enhancedFinder.ripgrepPath` is ignored (see `capabilities.untrustedWorkspaces`
  in `package.json`), so an untrusted folder cannot point the extension at an
  arbitrary executable.

## Reporting

Found a security issue? Please open an issue at
<https://github.com/rriquelme/enhanced-finder-vs-code/issues>.
