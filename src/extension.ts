import * as vscode from 'vscode';
import { FileStore } from './store/fileStore.js';
import { MemberStore } from './store/memberStore.js';
import { PreviewProvider } from './providers/previewProvider.js';
import { CommentTreeProvider, CommentItem } from './providers/commentTreeProvider.js';
import { getGitIdentity } from './auth/gitIdentity.js';

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
  const memberStore = new MemberStore(workspaceRoot);
  const previewProvider = new PreviewProvider(context, store, memberStore);
  const treeProvider = new CommentTreeProvider(store);

  // Seed the members file with the current user and wire identity to tree provider
  getGitIdentity().then(async (author) => {
    await memberStore.ensureCurrentUser(author);
    await memberStore.syncFromGitLog(workspaceRoot);
    treeProvider.setIdentity(author.name);
  });

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

    vscode.commands.registerCommand('ceramicMark.focusComment', (commentId: string) => {
      previewProvider.focusComment(commentId);
    }),

    vscode.commands.registerCommand('ceramicMark.resolveComment', (item: CommentItem) => {
      previewProvider.resolveComment(item.comment.id);
    }),

    vscode.commands.registerCommand('ceramicMark.reopenComment', (item: CommentItem) => {
      previewProvider.reopenComment(item.comment.id);
    }),

    vscode.commands.registerCommand('ceramicMark.deleteComment', (item: CommentItem) => {
      previewProvider.deleteComment(item.comment.id);
    }),

    (() => {
      const treeView = vscode.window.createTreeView('ceramicMark.comments', {
        treeDataProvider: treeProvider,
      });
      treeView.onDidChangeVisibility((e) => {
        if (e.visible) {
          previewProvider.open();
        }
      });
      return treeView;
    })(),

    watcher,
  );
}

export function deactivate(): void {
  // Nothing to clean up — subscriptions handle disposal
}
