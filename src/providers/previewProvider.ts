import * as vscode from 'vscode';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { ICommentStore } from '../store/ICommentStore.js';
import type { MemberStore } from '../store/memberStore.js';
import type { Comment, ExtensionMessage, WebviewMessage, Reply } from '../types.js';
import { getGitIdentity } from '../auth/gitIdentity.js';

export class PreviewProvider {
  public static readonly viewType = 'ceramicMark.preview';
  private panel: vscode.WebviewPanel | undefined;
  private readonly onCommentChangedEmitter = new vscode.EventEmitter<void>();
  public readonly onCommentChanged = this.onCommentChangedEmitter.event;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly store: ICommentStore,
    private readonly memberStore: MemberStore,
  ) {}

  public open(): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      PreviewProvider.viewType,
      'CeramicMark',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview'),
        ],
      },
    );

    this.panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'images', 'cm_icon.svg');
    this.panel.webview.html = this.getHtml(this.panel.webview);

    this.panel.webview.onDidReceiveMessage(
      (message: WebviewMessage) => this.handleMessage(message),
      undefined,
      this.context.subscriptions,
    );

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
  }

  private async handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case 'ready': {
        await this.sendIdentity();
        await this.sendAllComments();
        break;
      }

      case 'requestComments': {
        await this.sendAllComments();
        break;
      }

      case 'addComment': {
        const author = await getGitIdentity();
        const comment: Comment = {
          id: randomUUID(),
          createdAt: new Date().toISOString(),
          author,
          position: message.position,
          codeRef: message.codeRef,
          body: message.body,
          mentions: message.mentions ?? [],
          replies: [],
          status: 'open',
        };
        await this.store.add(comment);
        this.postMessage({ type: 'commentAdded', comment });
        this.onCommentChangedEmitter.fire();
        break;
      }

      case 'addReply': {
        const comments = await this.store.getAll();
        const target = comments.find((c) => c.id === message.commentId);
        if (!target) return;
        const author = await getGitIdentity();
        const reply: Reply = {
          id: randomUUID(),
          createdAt: new Date().toISOString(),
          author,
          body: message.body,
          mentions: message.mentions ?? [],
        };
        target.replies.push(reply);
        await this.store.update(target);
        this.postMessage({ type: 'commentUpdated', comment: target });
        this.onCommentChangedEmitter.fire();
        break;
      }

      case 'resolveComment':
      case 'reopenComment': {
        const comments = await this.store.getAll();
        const target = comments.find((c) => c.id === message.commentId);
        if (!target) return;
        target.status = message.type === 'resolveComment' ? 'resolved' : 'open';
        await this.store.update(target);
        this.postMessage({ type: 'commentUpdated', comment: target });
        this.onCommentChangedEmitter.fire();
        break;
      }
    }
  }

  private async sendAllComments(): Promise<void> {
    const comments = await this.store.getAll();
    this.postMessage({ type: 'loadComments', comments });
  }

  private async sendIdentity(): Promise<void> {
    const author = await getGitIdentity();
    this.postMessage({ type: 'identity', author });
    const members = await this.memberStore.getAll();
    this.postMessage({ type: 'loadMembers', members });
  }

  private postMessage(message: ExtensionMessage): void {
    this.panel?.webview.postMessage(message);
  }

  public focusPin(commentId: string): void {
    this.open();
    // Small delay to allow the panel to mount before sending the message
    setTimeout(() => this.postMessage({ type: 'focusPin', commentId }), 300);
  }

  public async resolveComment(commentId: string): Promise<void> {
    const comments = await this.store.getAll();
    const target = comments.find((c) => c.id === commentId);
    if (!target) return;
    target.status = 'resolved';
    await this.store.update(target);
    this.postMessage({ type: 'commentUpdated', comment: target });
    this.onCommentChangedEmitter.fire();
  }

  public async reopenComment(commentId: string): Promise<void> {
    const comments = await this.store.getAll();
    const target = comments.find((c) => c.id === commentId);
    if (!target) return;
    target.status = 'open';
    await this.store.update(target);
    this.postMessage({ type: 'commentUpdated', comment: target });
    this.onCommentChangedEmitter.fire();
  }

  public async deleteComment(commentId: string): Promise<void> {
    const confirmed = await vscode.window.showWarningMessage(
      'Delete this comment?',
      { modal: true },
      'Delete',
    );
    if (confirmed !== 'Delete') return;
    await this.store.delete(commentId);
    this.postMessage({ type: 'commentDeleted', commentId });
    this.onCommentChangedEmitter.fire();
  }

  /** Refresh comment pins after an external file change */
  public async refresh(): Promise<void> {
    if (this.panel) {
      await this.sendAllComments();
    }
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'index.js'),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'index.css'),
    );
    const nonce = randomUUID().replace(/-/g, '');

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
             style-src ${webview.cspSource} 'unsafe-inline';
             script-src 'nonce-${nonce}';
             frame-src *;
             img-src ${webview.cspSource} https: data:;" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${styleUri}" />
  <title>CeramicMark</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
