// Pure (filesystem-only) ripgrep locator, free of vscode imports so it can be
// unit-tested. Handles the VS Code binary layouts across versions.
//
// VS Code 1.122+ ships ripgrep as `@vscode/ripgrep-universal` with a
// `bin/<platform>-<arch>/rg` layout; older builds used `@vscode/ripgrep` with
// `bin/rg`. We check the known layouts under both `node_modules` and
// `node_modules.asar.unpacked`, then fall back to scanning any
// `@vscode/ripgrep*` package's `bin` directory so future renames keep working.
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Locate a ripgrep binary inside a VS Code install root.
 * Returns the resolved path (if any) plus every location tried, for error
 * reporting.
 */
export function locateRgBinary(
  root: string | undefined,
  platform: NodeJS.Platform,
  arch: string,
): { path?: string; tried: string[] } {
  const tried: string[] = [];
  if (!root) {
    return { tried };
  }

  const exe = platform === 'win32' ? 'rg.exe' : 'rg';
  const platArch = `${platform}-${arch}`;
  const moduleRoots = [
    path.join(root, 'node_modules'),
    path.join(root, 'node_modules.asar.unpacked'),
  ];

  const relCandidates = [
    ['@vscode', 'ripgrep-universal', 'bin', platArch, exe],
    ['@vscode', 'ripgrep', 'bin', platArch, exe],
    ['@vscode', 'ripgrep', 'bin', exe],
    ['vscode-ripgrep', 'bin', exe],
  ];

  for (const moduleRoot of moduleRoots) {
    for (const rel of relCandidates) {
      const candidate = path.join(moduleRoot, ...rel);
      tried.push(candidate);
      if (safeExists(candidate)) {
        return { path: candidate, tried };
      }
    }
  }

  // Fallback: scan @vscode/ripgrep* packages for a bin/[<platform-arch>/]rg.
  for (const moduleRoot of moduleRoots) {
    const scoped = path.join(moduleRoot, '@vscode');
    let names: string[] = [];
    try {
      names = fs.readdirSync(scoped);
    } catch {
      continue;
    }
    for (const name of names) {
      if (!/ripgrep/i.test(name)) {
        continue;
      }
      for (const rel of [
        [name, 'bin', platArch, exe],
        [name, 'bin', exe],
      ]) {
        const candidate = path.join(scoped, ...rel);
        tried.push(candidate);
        if (safeExists(candidate)) {
          return { path: candidate, tried };
        }
      }
    }
  }

  // Last resort: rely on ripgrep being on the PATH.
  tried.push(`${exe} (on PATH)`);
  return { path: undefined, tried };
}

function safeExists(p: string): boolean {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}
