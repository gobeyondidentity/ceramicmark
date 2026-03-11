import * as vscode from 'vscode';
import type { ICommentStore } from '../store/ICommentStore.js';
import type { Comment } from '../types.js';

class CommentItem extends vscode.TreeItem {
  constructor(public readonly comment: Comment) {
    const label = comment.body.length > 60
      ? comment.body.slice(0, 57) + '...'
      : comment.body;

    super(label, vscode.TreeItemCollapsibleState.None);

    this.description = comment.author.name;
    this.tooltip = `${comment.author.name}: ${comment.body}`;
    this.contextValue = comment.status === 'resolved' ? 'resolvedComment' : 'openComment';
    this.iconPath = comment.status === 'resolved'
      ? new vscode.ThemeIcon('pass-filled', new vscode.ThemeColor('testing.iconPassed'))
      : new vscode.ThemeIcon('comment');

    if (comment.codeRef) {
      this.command = {
        command: 'vscode.open',
        title: 'Go to file',
        arguments: [
          vscode.Uri.file(comment.codeRef.file),
          { selection: new vscode.Range(comment.codeRef.line - 1, 0, comment.codeRef.line - 1, 0) },
        ],
      };
    }
  }
}

export class CommentTreeProvider implements vscode.TreeDataProvider<CommentItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<CommentItem | undefined | void>();
  public readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(private readonly store: ICommentStore) {}

  public refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: CommentItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<CommentItem[]> {
    const comments = await this.store.getAll();
    // Show open comments first, then resolved
    return comments
      .sort((a, b) => {
        if (a.status === b.status) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return a.status === 'open' ? -1 : 1;
      })
      .map((c) => new CommentItem(c));
  }
}
