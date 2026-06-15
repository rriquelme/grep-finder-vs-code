// Spawns ripgrep and streams parsed results. Handles cancellation of stale
// searches and resolves the ripgrep binary path. Supports multi-root workspaces
// by passing every folder path to a single ripgrep invocation.
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { buildRgArgs } from './args';
import { RgJsonParser } from './rgJsonParser';
import type { SearchModel, SearchOptions } from '../models';

export class SearchService {
  private active: ChildProcessWithoutNullStreams | null = null;

  /** Cancel any in-flight search. */
  cancel(): void {
    if (this.active) {
      this.active.kill();
      this.active = null;
    }
  }

  /**
   * Run a search across the given workspace folders. Calls `onUpdate`
   * periodically with the model built so far, and resolves with the final
   * model. Relative paths are folder-prefixed when more than one folder is
   * searched, so results from different roots stay distinguishable.
   */
  async search(
    opts: SearchOptions,
    folders: readonly vscode.WorkspaceFolder[],
    onUpdate?: (model: SearchModel) => void,
  ): Promise<SearchModel> {
    this.cancel();

    if (folders.length === 0) {
      return { files: [], truncated: false, totalMatches: 0 };
    }

    const config = vscode.workspace.getConfiguration('enhancedFinder');
    const useSmartCase = config.get<boolean>('useSmartCase', true);
    const maxResults = config.get<number>('maxResults', 2000);
    const rgPath = resolveRgPath(config.get<string>('ripgrepPath', ''));

    const multiRoot = folders.length > 1;
    const searchPaths = folders.map((f) => f.uri.fsPath);
    const args = [...buildRgArgs(opts, { useSmartCase }), ...searchPaths];

    const parser = new RgJsonParser(
      (abs) => vscode.workspace.asRelativePath(vscode.Uri.file(abs), multiRoot),
      (abs) => vscode.Uri.file(abs).toString(),
      maxResults,
    );

    return new Promise<SearchModel>((resolve) => {
      const child = spawn(rgPath, args, { cwd: folders[0].uri.fsPath });
      this.active = child;

      let updateTimer: NodeJS.Timeout | null = null;
      const scheduleUpdate = () => {
        if (onUpdate && !updateTimer) {
          updateTimer = setTimeout(() => {
            updateTimer = null;
            onUpdate(parser.build());
          }, 100);
        }
      };

      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        parser.push(chunk);
        scheduleUpdate();
        if (parser.build().truncated) {
          child.kill();
        }
      });

      child.stderr.setEncoding('utf8');
      child.stderr.on('data', () => {
        /* ripgrep writes benign warnings here; ignore for now. */
      });

      const done = () => {
        if (this.active === child) {
          this.active = null;
        }
        if (updateTimer) {
          clearTimeout(updateTimer);
        }
        resolve(parser.finish());
      };

      child.on('error', done);
      child.on('close', done);
    });
  }
}

/**
 * Resolve a ripgrep binary without bundling one. Order of preference:
 *   1. The `enhancedFinder.ripgrepPath` setting, if set.
 *   2. The ripgrep that VS Code ships (under `vscode.env.appRoot`) — every
 *      install has it because the built-in Search uses it.
 *   3. `rg` on the PATH.
 */
function resolveRgPath(override: string): string {
  if (override && override.trim()) {
    return override.trim();
  }

  const exe = process.platform === 'win32' ? 'rg.exe' : 'rg';
  const root = vscode.env.appRoot;
  if (root) {
    const candidates = [
      path.join(root, 'node_modules', '@vscode', 'ripgrep', 'bin', exe),
      path.join(root, 'node_modules.asar.unpacked', '@vscode', 'ripgrep', 'bin', exe),
      path.join(root, 'node_modules', 'vscode-ripgrep', 'bin', exe),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  // Last resort: assume ripgrep is on the PATH.
  return exe;
}
