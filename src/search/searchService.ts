// Spawns ripgrep and streams parsed results. Handles cancellation of stale
// searches and resolves the ripgrep binary path. Supports multi-root workspaces
// by passing every folder path to a single ripgrep invocation.
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import * as vscode from 'vscode';
import { buildRgArgs } from './args';
import { locateRgBinary } from './rgLocate';
import { RgJsonParser } from './rgJsonParser';
import type { SearchModel, SearchOptions } from '../models';

let channel: vscode.OutputChannel | undefined;
function log(message: string): void {
  channel ??= vscode.window.createOutputChannel('Enhanced Finder');
  channel.appendLine(message);
}

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

    const override = (config.get<string>('ripgrepPath', '') || '').trim();
    let rgPath = override;
    let triedLocations: string[] = [];
    if (!rgPath) {
      const found = findRgBinary();
      triedLocations = found.tried;
      // Fall back to `rg` on the PATH if VS Code's copy isn't where we expect.
      rgPath = found.path ?? (process.platform === 'win32' ? 'rg.exe' : 'rg');
      if (!found.path) {
        log(`ripgrep not found in the VS Code install; trying PATH. Checked:\n  ${found.tried.join('\n  ')}`);
      }
    }

    const multiRoot = folders.length > 1;
    const searchPaths = folders.map((f) => f.uri.fsPath);
    const args = [...buildRgArgs(opts, { useSmartCase }), ...searchPaths];

    log(`rg: ${rgPath}`);
    log(`args: ${args.join(' ')}`);

    const parser = new RgJsonParser(
      (abs) => vscode.workspace.asRelativePath(vscode.Uri.file(abs), multiRoot),
      (abs) => vscode.Uri.file(abs).toString(),
      maxResults,
    );

    return new Promise<SearchModel>((resolve, reject) => {
      let child: ChildProcessWithoutNullStreams;
      try {
        child = spawn(rgPath, args, { cwd: folders[0].uri.fsPath });
      } catch (err) {
        reject(new Error(`Could not launch ripgrep at "${rgPath}": ${String(err)}`));
        return;
      }
      this.active = child;

      let stderr = '';
      let settled = false;

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
      child.stderr.on('data', (chunk: string) => {
        stderr += chunk;
      });

      const cleanup = () => {
        if (this.active === child) {
          this.active = null;
        }
        if (updateTimer) {
          clearTimeout(updateTimer);
        }
      };

      // Spawn-level failure (e.g. ENOENT when the binary path is wrong).
      child.on('error', (err) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        log(`spawn error: ${String(err)}`);
        const hint =
          ' Set "enhancedFinder.ripgrepPath" to a ripgrep binary.' +
          (triedLocations.length ? `\nChecked:\n  ${triedLocations.join('\n  ')}` : '');
        reject(new Error(`Could not run ripgrep at "${rgPath}": ${err.message}.${hint}`));
      });

      // ripgrep exit codes: 0 = matches, 1 = no matches, 2 = error.
      child.on('close', (code) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        if (code === 2 && parser.build().totalMatches === 0) {
          log(`ripgrep error (exit 2): ${stderr.trim()}`);
          reject(new Error(stderr.trim() || 'ripgrep exited with an error.'));
          return;
        }
        if (stderr.trim()) {
          log(`ripgrep stderr: ${stderr.trim()}`);
        }
        resolve(parser.finish());
      });
    });
  }
}

/**
 * Locate a ripgrep binary that ships with VS Code, without bundling one.
 *
 * VS Code 1.122+ ships ripgrep as `@vscode/ripgrep-universal` with a
 * `bin/<platform>-<arch>/rg` layout; older builds used `@vscode/ripgrep`
 * with `bin/rg`. We check the known layouts under both `node_modules` and
 * `node_modules.asar.unpacked`, then fall back to scanning any
 * `@vscode/ripgrep*` package's `bin` directory so future renames keep working.
 *
 * Returns the resolved path (if any) plus every location we tried, for error
 * reporting.
 */
function findRgBinary(): { path?: string; tried: string[] } {
  return locateRgBinary(vscode.env.appRoot, process.platform, process.arch);
}
