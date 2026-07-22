import * as vscode from 'vscode';
import { SearchViewProvider } from './view/searchViewProvider';

export function activate(context: vscode.ExtensionContext): void {
  const provider = new SearchViewProvider(context.extensionUri, context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SearchViewProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand('grepFinder.focus', () => provider.focus()),
  );
}

export function deactivate(): void {
  // Nothing to clean up explicitly; subscriptions are disposed by VS Code.
}
