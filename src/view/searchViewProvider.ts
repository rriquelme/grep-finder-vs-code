// Webview view hosted in the Enhanced Finder activity-bar container. Owns the
// search form + results UI and routes messages between the webview and the
// extension host services.
import * as vscode from 'vscode';
import { SearchService } from '../search/searchService';
import { openInGrid, type GridTarget } from '../grid/gridService';
import type { MatchBlock, SearchModel, SearchOptions } from '../models';

type InboundMessage =
  | { type: 'search'; options: SearchOptions }
  | { type: 'cancel' }
  | { type: 'openMatch'; fileUri: string; anchorLine: number; anchorColumn: number }
  | { type: 'openGrid'; targets: GridTarget[] };

type OutboundMessage =
  | { type: 'results'; model: SearchModel; done: boolean }
  | { type: 'error'; message: string }
  | { type: 'config'; defaultContextLines: number };

export class SearchViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'enhancedFinder.searchView';

  private view?: vscode.WebviewView;
  private readonly search = new SearchService();

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')],
    };
    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((msg: InboundMessage) => this.onMessage(msg));

    const defaultContextLines = vscode.workspace
      .getConfiguration('enhancedFinder')
      .get<number>('defaultContextLines', 2);
    this.post({ type: 'config', defaultContextLines });
  }

  focus(): void {
    this.view?.show?.(true);
  }

  private async onMessage(msg: InboundMessage): Promise<void> {
    switch (msg.type) {
      case 'search':
        await this.runSearch(msg.options);
        break;
      case 'cancel':
        this.search.cancel();
        break;
      case 'openMatch':
        await this.openSingle(msg.fileUri, msg.anchorLine, msg.anchorColumn);
        break;
      case 'openGrid':
        await openInGrid(msg.targets);
        break;
    }
  }

  private async runSearch(options: SearchOptions): Promise<void> {
    if (!options.query.trim()) {
      this.post({ type: 'results', model: emptyModel(), done: true });
      return;
    }
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      this.post({ type: 'error', message: 'Open a folder to search.' });
      return;
    }
    try {
      const model = await this.search.search(options, folder, (partial) =>
        this.post({ type: 'results', model: partial, done: false }),
      );
      this.post({ type: 'results', model, done: true });
    } catch (err) {
      this.post({ type: 'error', message: String(err) });
    }
  }

  private async openSingle(fileUri: string, anchorLine: number, anchorColumn: number): Promise<void> {
    const line = Math.max(0, anchorLine - 1);
    const col = Math.max(0, anchorColumn);
    const pos = new vscode.Position(line, col);
    const selection = new vscode.Selection(pos, pos);
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(fileUri));
    const editor = await vscode.window.showTextDocument(doc, { selection, preview: true });
    editor.revealRange(selection, vscode.TextEditorRevealType.InCenter);
  }

  private post(msg: OutboundMessage): void {
    void this.view?.webview.postMessage(msg);
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'main.js'),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'main.css'),
    );
    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource}`,
      `script-src 'nonce-${nonce}'`,
      `font-src ${webview.cspSource}`,
    ].join('; ');

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="${styleUri}" rel="stylesheet" />
  <title>Enhanced Finder</title>
</head>
<body>
  <div id="app"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function emptyModel(): SearchModel {
  return { files: [], truncated: false, totalMatches: 0 };
}

export function buildGridTargets(blocks: MatchBlock[]): GridTarget[] {
  return blocks.map((b) => ({
    fileUri: b.fileUri,
    anchorLine: b.anchorLine,
    anchorColumn: b.anchorColumn,
  }));
}

function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
