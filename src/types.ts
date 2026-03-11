export interface Author {
  name: string;
  email: string;
}

export interface Position {
  /** Percentage (0–100) of the iframe width */
  x: number;
  /** Percentage (0–100) of the iframe height */
  y: number;
  /** Scroll offset (px) of the iframe at the time the pin was placed */
  scrollY: number;
}

export interface CodeRef {
  /** Workspace-relative file path */
  file: string;
  /** 1-based line number */
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
  /** Optional association with a source file location */
  codeRef?: CodeRef;
  body: string;
  replies: Reply[];
  status: 'open' | 'resolved';
}

export interface CommentsFile {
  version: 1;
  comments: Comment[];
}

// Messages sent from the extension host → webview
export type ExtensionMessage =
  | { type: 'loadComments'; comments: Comment[] }
  | { type: 'commentAdded'; comment: Comment }
  | { type: 'commentUpdated'; comment: Comment }
  | { type: 'identity'; author: Author };

// Messages sent from the webview → extension host
export type WebviewMessage =
  | { type: 'ready' }
  | { type: 'addComment'; position: Position; body: string; codeRef?: CodeRef }
  | { type: 'addReply'; commentId: string; body: string }
  | { type: 'resolveComment'; commentId: string }
  | { type: 'reopenComment'; commentId: string }
  | { type: 'requestComments' };
