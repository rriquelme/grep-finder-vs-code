// Spawns ripgrep and streams parsed results. Handles cancellation of stale
// searches and resolves the ripgrep binary path.
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
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
   * Run a search in the given workspace folder. Calls `onUpdate` periodically
   * with the model built so far, and resolves with the final model.
   */
  async search(
    opts: SearchOptions,
    folder: vscode.WorkspaceFolder,
    onUpdate?: (model: SearchModel) => void,
  ): Promise<SearchModel> {
    this.cancel();

    const config = vscode.workspace.getConfiguration('enhancedFinder');
    const useSmartCase = config.get<boolean>('useSmartCase', true);
    const maxResults = config.get<number>('maxResults', 2000);
    const rgPath = resolveRgPath(config.get<string>('ripgrepPath', ''));

    const root = folder.uri.fsPath;
    const args = buildRgArgs(opts, { useSmartCase });

    const parser = new RgJsonParser(
      (abs) => path.relative(root, abs) || abs,
      (abs) => vscode.Uri.file(abs).toString(),
      maxResults,
    );

    return new Promise<SearchModel>((resolve) => {
      const child = spawn(rgPath, args, { cwd: root });
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

function resolveRgPath(override: string): string {
  if (override && override.trim()) {
    return override.trim();
  }
  // Lazily require so the parser/arg tests stay dependency-free.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { rgPath } = require('@vscode/ripgrep') as { rgPath: string };
  return rgPath;
}
