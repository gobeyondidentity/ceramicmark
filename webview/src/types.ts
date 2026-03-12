// Mirror of src/types.ts for the webview bundle
// Keep in sync with the extension host types

export interface Author {
  name: string;
  email: string;
}

export interface Position {
  x: number;
  y: number;
  scrollY: number;
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
}

export interface Comment {
  id: string;
  createdAt: string;
  author: Author;
  position: Position;
  codeRef?: CodeRef;
  body: string;
  replies: Reply[];
  status: 'open' | 'resolved';
}

export type ExtensionMessage =
  | { type: 'loadComments'; comments: Comment[] }
  | { type: 'commentAdded'; comment: Comment }
  | { type: 'commentUpdated'; comment: Comment }
  | { type: 'commentDeleted'; commentId: string }
  | { type: 'focusPin'; commentId: string }
  | { type: 'identity'; author: Author };

export type WebviewMessage =
  | { type: 'ready' }
  | { type: 'addComment'; position: Position; body: string; codeRef?: CodeRef }
  | { type: 'addReply'; commentId: string; body: string }
  | { type: 'resolveComment'; commentId: string }
  | { type: 'reopenComment'; commentId: string }
  | { type: 'requestComments' };
