export interface Author {
  name: string;
  email: string;
}

export interface Member {
  name: string;
  email: string;
}

export interface MembersFile {
  version: 1;
  members: Member[];
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
  mentions?: string[];
}

export interface Comment {
  id: string;
  createdAt: string;
  author: Author;
  position: Position;
  /** Optional association with a source file location */
  codeRef?: CodeRef;
  body: string;
  mentions?: string[];
  replies: Reply[];
  status: 'open' | 'resolved';
  branch?: string;
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
  | { type: 'commentDeleted'; commentId: string }
  | { type: 'focusPin'; commentId: string }
  | { type: 'identity'; author: Author }
  | { type: 'loadMembers'; members: Member[] }
  | { type: 'setBranch'; branch: string };

// Messages sent from the webview → extension host
export type WebviewMessage =
  | { type: 'ready' }
  | { type: 'addComment'; position: Position; body: string; codeRef?: CodeRef; mentions?: string[] }
  | { type: 'addReply'; commentId: string; body: string; mentions?: string[] }
  | { type: 'resolveComment'; commentId: string }
  | { type: 'reopenComment'; commentId: string }
  | { type: 'requestComments' };
