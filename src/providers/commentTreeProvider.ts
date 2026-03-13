import * as vscode from 'vscode';
import type { ICommentStore } from '../store/ICommentStore.js';
import type { Comment, Reply } from '../types.js';

type TreeNode = MentionedYouItem | MentionedCommentItem | PageItem | CommentItem | ReplyItem;

// ─── Mentioned You ───────────────────────────────────────────────────────────

export class MentionedYouItem extends vscode.TreeItem {
  constructor(public readonly mentionedComments: Comment[]) {
    super('Mentioned You', vscode.TreeItemCollapsibleState.Expanded);
    this.description = `${mentionedComments.length}`;
    this.iconPath = new vscode.ThemeIcon('mention');
    this.contextValue = 'mentionedYou';
  }
}

/** A comment shown under "Mentioned You" — same click behaviour as CommentItem */
export class MentionedCommentItem extends vscode.TreeItem {
  constructor(public readonly comment: Comment) {
    const label = comment.body.length > 60
      ? comment.body.slice(0, 57) + '...'
      : comment.body;

    super(label, vscode.TreeItemCollapsibleState.None);

    this.description = comment.author.name;
    this.tooltip = `${comment.author.name}: ${comment.body}`;
    this.iconPath = new vscode.ThemeIcon('comment');
    this.contextValue = 'mentionedComment';

    this.command = {
      command: 'ceramicMark.focusComment',
      title: 'Focus comment',
      arguments: [comment.id],
    };
  }
}

// ─── Page groups ──────────────────────────────────────────────────────────────

export class PageItem extends vscode.TreeItem {
  constructor(
    public readonly pageUrl: string,
    public readonly comments: Comment[],
  ) {
    super(pageUrl, vscode.TreeItemCollapsibleState.Expanded);
    const count = comments.length;
    this.description = `${count} comment${count !== 1 ? 's' : ''}`;
    this.iconPath = new vscode.ThemeIcon('link');
    this.contextValue = 'page';
  }
}

export class CommentItem extends vscode.TreeItem {
  constructor(public readonly comment: Comment) {
    const label = comment.anchor.label.length > 60
      ? comment.anchor.label.slice(0, 57) + '...'
      : comment.anchor.label;

    const collapsible = comment.replies.length > 0
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;

    super(label, collapsible);

    const replyCount = comment.replies.length;
    this.description = replyCount > 0
      ? `${replyCount} repl${replyCount !== 1 ? 'ies' : 'y'}`
      : comment.author.name;
    this.tooltip = `${comment.author.name}: ${comment.body}`;
    this.contextValue = comment.status === 'resolved' ? 'resolvedComment' : 'openComment';
    this.iconPath = comment.status === 'resolved'
      ? new vscode.ThemeIcon('pass-filled', new vscode.ThemeColor('testing.iconPassed'))
      : new vscode.ThemeIcon('comment');

    this.command = {
      command: 'ceramicMark.focusComment',
      title: 'Focus comment',
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
      command: 'ceramicMark.focusComment',
      title: 'Focus comment',
      arguments: [parentCommentId],
    };
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class CommentTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<TreeNode | undefined | void>();
  public readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  private currentUserName: string | null = null;

  constructor(private readonly store: ICommentStore) {}

  public setIdentity(name: string): void {
    this.currentUserName = name;
    this.onDidChangeTreeDataEmitter.fire();
  }

  public refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeNode): Promise<TreeNode[]> {
    // Root level
    if (!element) {
      const comments = await this.store.getAll();
      const result: TreeNode[] = [];

      // "Mentioned You" section — only shown when identity is known and mentions exist
      if (this.currentUserName) {
        const mentionPattern = `@${this.currentUserName}`;
        const mentioned = comments.filter((c) => {
          if (c.body.includes(mentionPattern)) return true;
          return c.replies.some((r) => r.body.includes(mentionPattern));
        });
        if (mentioned.length > 0) {
          result.push(new MentionedYouItem(mentioned));
        }
      }

      // Page groups, sorted alphabetically
      const byPage = new Map<string, Comment[]>();
      for (const comment of comments) {
        const page = comment.anchor.pageUrl || '/';
        if (!byPage.has(page)) byPage.set(page, []);
        byPage.get(page)!.push(comment);
      }
      const pageItems = [...byPage.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([page, pageComments]) => new PageItem(page, pageComments));

      return [...result, ...pageItems];
    }

    // "Mentioned You" children
    if (element instanceof MentionedYouItem) {
      return element.mentionedComments.map((c) => new MentionedCommentItem(c));
    }

    // Page children — open first, then resolved, newest first within each
    if (element instanceof PageItem) {
      return [...element.comments]
        .sort((a, b) => {
          if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        })
        .map((c) => new CommentItem(c));
    }

    // Comment children — replies in the thread
    if (element instanceof CommentItem) {
      return element.comment.replies.map((r) => new ReplyItem(r, element.comment.id));
    }

    return [];
  }
}
