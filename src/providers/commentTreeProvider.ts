import * as vscode from 'vscode';
import type { ICommentStore } from '../store/ICommentStore.js';
import type { Comment, Reply } from '../types.js';

type TreeNode = AuthorItem | CommentItem | ReplyItem;

export class AuthorItem extends vscode.TreeItem {
  constructor(
    public readonly authorName: string,
    public readonly comments: Comment[],
  ) {
    super(authorName, vscode.TreeItemCollapsibleState.Expanded);
    const count = comments.length;
    this.description = `${count} comment${count !== 1 ? 's' : ''}`;
    this.iconPath = new vscode.ThemeIcon('account');
    this.contextValue = 'author';
  }
}

export class CommentItem extends vscode.TreeItem {
  constructor(public readonly comment: Comment) {
    const label = comment.body.length > 60
      ? comment.body.slice(0, 57) + '...'
      : comment.body;

    const collapsible = comment.replies.length > 0
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;

    super(label, collapsible);

    const replyCount = comment.replies.length;
    this.description = replyCount > 0
      ? `${replyCount} repl${replyCount !== 1 ? 'ies' : 'y'}`
      : undefined;
    this.tooltip = `${comment.author.name}: ${comment.body}`;
    this.contextValue = comment.status === 'resolved' ? 'resolvedComment' : 'openComment';
    this.iconPath = comment.status === 'resolved'
      ? new vscode.ThemeIcon('pass-filled', new vscode.ThemeColor('testing.iconPassed'))
      : new vscode.ThemeIcon('comment');

    this.command = {
      command: 'ceramicMark.focusPin',
      title: 'Focus pin',
      arguments: [comment.id],
    };
  }
}

export class ReplyItem extends vscode.TreeItem {
  constructor(reply: Reply, public readonly parentCommentId: string) {
    const label = reply.body.length > 60
      ? reply.body.slice(0, 57) + '...'
      : reply.body;

    super(label, vscode.TreeItemCollapsibleState.None);

    this.description = reply.author.name;
    this.tooltip = `${reply.author.name}: ${reply.body}`;
    this.iconPath = new vscode.ThemeIcon('comment-discussion');
    this.contextValue = 'reply';

    this.command = {
      command: 'ceramicMark.focusPin',
      title: 'Focus pin',
      arguments: [parentCommentId],
    };
  }
}

export class CommentTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<TreeNode | undefined | void>();
  public readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(private readonly store: ICommentStore) {}

  public refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeNode): Promise<TreeNode[]> {
    // Root level: group comments by author, sorted alphabetically
    if (!element) {
      const comments = await this.store.getAll();
      const byAuthor = new Map<string, Comment[]>();
      for (const comment of comments) {
        const name = comment.author.name;
        if (!byAuthor.has(name)) byAuthor.set(name, []);
        byAuthor.get(name)!.push(comment);
      }
      return [...byAuthor.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, authorComments]) => new AuthorItem(name, authorComments));
    }

    // Author level: show their comments (open first, then resolved, newest first within each)
    if (element instanceof AuthorItem) {
      return [...element.comments]
        .sort((a, b) => {
          if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        })
        .map((c) => new CommentItem(c));
    }

    // Comment level: show replies in the thread
    if (element instanceof CommentItem) {
      return element.comment.replies.map((r) => new ReplyItem(r, element.comment.id));
    }

    return [];
  }
}
