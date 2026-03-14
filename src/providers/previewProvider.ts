import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { randomUUID } from 'crypto';
import type { ICommentStore } from '../store/ICommentStore.js';
import type { MemberStore } from '../store/memberStore.js';
import type { Comment, ExtensionMessage, WebviewMessage, Reply } from '../types.js';
import { getGitIdentity, getGitBranch } from '../auth/gitIdentity.js';
import { HttpProxy } from '../services/httpProxy.js';

export class PreviewProvider {
  public static readonly viewType = 'ceramicMark.preview';
  private panel: vscode.WebviewPanel | undefined;
  private proxy: HttpProxy | undefined;
  private readonly outputChannel = vscode.window.createOutputChannel('CeramicMark Proxy');
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
          vscode.Uri.joinPath(this.context.extensionUri, 'images'),
        ],
      },
    );

    this.panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'images', 'cm_tab_icon.svg');
    this.panel.webview.html = this.getHtml(this.panel.webview);

    this.panel.webview.onDidReceiveMessage(
      (message: WebviewMessage) => this.handleMessage(message),
      undefined,
      this.context.subscriptions,
    );

    this.panel.onDidDispose(() => {
      this.panel = undefined;
      this.proxy?.stop();
      this.proxy = undefined;
    });
  }

  private async handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case 'ready': {
        await this.sendIdentity();
        await this.sendAllComments();
        break;
      }

      case 'setTargetUrl': {
        let parsed: URL;
        try { parsed = new URL(message.url); } catch { break; }
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') break;
        const displayUrl = message.url;
        if (!this.proxy) {
          this.proxy = new HttpProxy(displayUrl, this.outputChannel);
        } else {
          this.proxy.updateTarget(displayUrl);
        }
        const port = await this.proxy.port;
        const proxyUrl = `http://127.0.0.1:${port}`;
        this.postMessage({ type: 'proxyReady', displayUrl, proxyUrl });
        break;
      }

      case 'requestComments': {
        await this.sendAllComments();
        break;
      }

      case 'addComment': {
        const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const [author, branch, existing] = await Promise.all([
          getGitIdentity(),
          getGitBranch(cwd),
          this.store.getAll(),
        ]);
        const comment: Comment = {
          id: randomUUID(),
          createdAt: new Date().toISOString(),
          author,
          anchor: message.anchor,
          codeRef: message.codeRef,
          body: message.body,
          mentions: message.mentions ?? [],
          replies: [],
          status: 'open',
          branch,
        };
        await this.store.add(comment);
        this.postMessage({ type: 'commentAdded', comment });
        this.onCommentChangedEmitter.fire();
        if (existing.length === 0) {
          await this.notifyFirstComment();
        }
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

      case 'deleteComment': {
        await this.deleteComment(message.commentId);
        break;
      }
    }
  }

  private async notifyFirstComment(): Promise<void> {
    if (this.context.workspaceState.get<boolean>('gitignorePrompted')) return;
    await this.context.workspaceState.update('gitignorePrompted', true);
    vscode.window.showInformationMessage(
      'CeramicMark: Comments saved to .ide-comments/ — commit this folder to share comments with your team.',
    );
  }

  private async sendAllComments(): Promise<void> {
    const comments = await this.store.getAll();
    this.postMessage({ type: 'loadComments', comments });
  }

  private async sendIdentity(): Promise<void> {
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const [author, branch, members] = await Promise.all([
      getGitIdentity(),
      getGitBranch(cwd),
      this.memberStore.getAll(),
    ]);
    this.postMessage({ type: 'identity', author });
    this.postMessage({ type: 'setBranch', branch });
    this.postMessage({ type: 'loadMembers', members });
  }

  private postMessage(message: ExtensionMessage): void {
    this.panel?.webview.postMessage(message);
  }

  public toggleCommentMode(): void {
    if (!this.panel) {
      this.open();
      return;
    }
    this.panel.reveal();
    this.postMessage({ type: 'toggleCommentMode' });
  }

  public focusComment(commentId: string): void {
    this.open();
    setTimeout(() => this.postMessage({ type: 'focusComment', commentId }), 300);
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

  /** Refresh comment list after an external file change */
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
    const bgUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'images', 'cm_bg.jpg'),
    );
    const sadUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'images', 'cm_sad.svg'),
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
  <meta name="cm-bg" content="${bgUri}" />
  <meta name="cm-sad" content="${sadUri}" />
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
