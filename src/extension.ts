import * as vscode from 'vscode';
import { FileStore } from './store/fileStore.js';
import { PreviewProvider } from './providers/previewProvider.js';
import { CommentTreeProvider } from './providers/commentTreeProvider.js';

export function activate(context: vscode.ExtensionContext): void {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  if (!workspaceRoot) {
    // Extension still activates but commands will show a message
    vscode.commands.registerCommand('ceramicMark.openPreview', () => {
      vscode.window.showInformationMessage('CeramicMark requires an open workspace folder.');
    });
    return;
  }

  const store = new FileStore(workspaceRoot);
  const previewProvider = new PreviewProvider(context, store);
  const treeProvider = new CommentTreeProvider(store);

  // Refresh sidebar whenever comments change
  previewProvider.onCommentChanged(() => {
    treeProvider.refresh();
  });

  // Watch for external changes to the comments file (e.g. git pull)
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(workspaceRoot, '.ide-comments/comments.json'),
  );
  watcher.onDidChange(async () => {
    await previewProvider.refresh();
    treeProvider.refresh();
  });
  watcher.onDidCreate(async () => {
    await previewProvider.refresh();
    treeProvider.refresh();
  });

  context.subscriptions.push(
    vscode.commands.registerCommand('ceramicMark.openPreview', () => {
      previewProvider.open();
    }),

    vscode.window.registerTreeDataProvider('ceramicMark.comments', treeProvider),

    watcher,
  );
}

export function deactivate(): void {
  // Nothing to clean up — subscriptions handle disposal
}
