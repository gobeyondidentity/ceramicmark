// Mirror of src/types.ts for the webview bundle
// Keep in sync with the extension host types

export interface Author {
  name: string;
  email: string;
}

export interface Member {
  name: string;
  email: string;
}

export interface ElementAnchor {
  pageUrl: string;
  /** Document title at the time of comment placement — used as a page identity fallback
   *  when the app uses React-state navigation (URL stays at '/') */
  pageTitle?: string;
  label: string;
  tag?: string;
  elementId?: string;
  testId?: string;
  text?: string;
  cssPath?: string;
  thumbnail?: string;
}

export interface CodeRef {
  file: string;
  line: number;
}

export interface Reply {
  id: string;
  createdAt: string;
  author: Author;
  body: string;
  mentions?: string[];
}

export interface Comment {
  id: string;
  createdAt: string;
  author: Author;
  anchor: ElementAnchor;
  codeRef?: CodeRef;
  body: string;
  mentions?: string[];
  replies: Reply[];
  status: 'open' | 'resolved';
  branch?: string;
}

export type ExtensionMessage =
  | { type: 'loadComments'; comments: Comment[] }
  | { type: 'commentAdded'; comment: Comment }
  | { type: 'commentUpdated'; comment: Comment }
  | { type: 'commentDeleted'; commentId: string }
  | { type: 'focusComment'; commentId: string }
  | { type: 'identity'; author: Author }
  | { type: 'loadMembers'; members: Member[] }
  | { type: 'setBranch'; branch: string }
  | { type: 'proxyReady'; displayUrl: string; proxyUrl: string }
  | { type: 'toggleCommentMode' };

export type WebviewMessage =
  | { type: 'ready' }
  | { type: 'setTargetUrl'; url: string }
  | { type: 'addComment'; anchor: ElementAnchor; body: string; codeRef?: CodeRef; mentions?: string[] }
  | { type: 'addReply'; commentId: string; body: string; mentions?: string[] }
  | { type: 'resolveComment'; commentId: string }
  | { type: 'reopenComment'; commentId: string }
  | { type: 'deleteComment'; commentId: string }
  | { type: 'requestComments' };
