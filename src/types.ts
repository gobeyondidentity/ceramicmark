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

export interface ElementAnchor {
  /** Page pathname where the comment was placed, e.g. '/dashboard' */
  pageUrl: string;
  /** Human-readable label auto-generated from element: "Submit button · #submit-btn" */
  label: string;
  /** tag name of the clicked element */
  tag?: string;
  /** element id attribute */
  elementId?: string;
  /** data-testid attribute */
  testId?: string;
  /** visible text content (truncated) */
  text?: string;
  /** CSS path fallback for elements with no id/testId/text */
  cssPath?: string;
  /** workspace-relative path to screenshot thumbnail, if captured */
  thumbnail?: string;
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
  anchor: ElementAnchor;
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
  | { type: 'focusComment'; commentId: string }
  | { type: 'identity'; author: Author }
  | { type: 'loadMembers'; members: Member[] }
  | { type: 'setBranch'; branch: string }
  | { type: 'proxyReady'; displayUrl: string; proxyUrl: string };

// Messages sent from the webview → extension host
export type WebviewMessage =
  | { type: 'ready' }
  | { type: 'setTargetUrl'; url: string }
  | { type: 'addComment'; anchor: ElementAnchor; body: string; codeRef?: CodeRef; mentions?: string[] }
  | { type: 'addReply'; commentId: string; body: string; mentions?: string[] }
  | { type: 'resolveComment'; commentId: string }
  | { type: 'reopenComment'; commentId: string }
  | { type: 'deleteComment'; commentId: string }
  | { type: 'requestComments' };
