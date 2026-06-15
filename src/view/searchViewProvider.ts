// Webview view hosted in the Enhanced Finder activity-bar container. Owns the
// search form + results UI and routes messages between the webview and the
// extension host services.
import * as vscode from 'vscode';
import { SearchService } from '../search/searchService';
import { applyEditsToModel, type LineEdit } from '../search/lineShift';
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

  // Current result set + last query, kept so we can sync line numbers to edits
  // and re-run on save.
  private model: SearchModel = emptyModel();
  private lastOptions?: SearchOptions;
  private postTimer?: ReturnType<typeof setTimeout>;
  private researchTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly extensionUri: vscode.Uri,
    context: vscode.ExtensionContext,
  ) {
    context.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument((e) => this.onDocChange(e)),
      vscode.workspace.onDidSaveTextDocument((d) => this.onDocSave(d)),
    );
  }

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
    this.lastOptions = options;
    if (!options.query.trim()) {
      this.model = emptyModel();
      this.post({ type: 'results', model: this.model, done: true });
      return;
    }
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      this.post({ type: 'error', message: 'Open a folder to search.' });
      return;
    }
    try {
      const model = await this.search.search(options, folders, (partial) => {
        this.model = partial;
        this.post({ type: 'results', model: partial, done: false });
      });
      this.model = model;
      this.post({ type: 'results', model, done: true });
    } catch (err) {
      this.post({ type: 'error', message: String(err) });
    }
  }

  /** Live-shift stored line numbers so clicks keep landing on the right line
   *  even before the file is saved. */
  private onDocChange(event: vscode.TextDocumentChangeEvent): void {
    if (this.model.files.length === 0 || event.contentChanges.length === 0) {
      return;
    }
    const uri = event.document.uri.toString();
    if (!this.model.files.some((f) => f.fileUri === uri)) {
      return;
    }
    const edits: LineEdit[] = event.contentChanges.map((c) => ({
      startLine: c.range.start.line,
      endLine: c.range.end.line,
      addedLines: countNewlines(c.text),
    }));
    if (applyEditsToModel(this.model, uri, edits)) {
      this.schedulePost();
    }
  }

  /** On save, re-run the search so result text and positions are authoritative. */
  private onDocSave(doc: vscode.TextDocument): void {
    if (!this.lastOptions?.query.trim() || this.model.files.length === 0) {
      return;
    }
    if (!this.model.files.some((f) => f.fileUri === doc.uri.toString())) {
      return;
    }
    if (this.researchTimer) {
      clearTimeout(this.researchTimer);
    }
    this.researchTimer = setTimeout(() => {
      if (this.lastOptions) {
        void this.runSearch(this.lastOptions);
      }
    }, 200);
  }

  private schedulePost(): void {
    if (this.postTimer) {
      clearTimeout(this.postTimer);
    }
    this.postTimer = setTimeout(() => {
      this.post({ type: 'results', model: this.model, done: true });
    }, 150);
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
    const codiconUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'codicons', 'codicon.css'),
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
  <link href="${codiconUri}" rel="stylesheet" />
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

function countNewlines(text: string): number {
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) {
      n++;
    }
  }
  return n;
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
