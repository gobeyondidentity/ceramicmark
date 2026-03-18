import React, { useEffect, useRef, useState } from 'react';
import type { Comment } from './types.js';

/** Convert a URL pathname to a friendly display label. e.g. "/" → "Homepage", "/user-profile" → "User Profile" */
function pageLabel(url: string): string {
  const path = url.split('?')[0].split('#')[0];
  if (path === '/' || path === '') return 'Homepage';
  return path
    .split('/')
    .filter(Boolean)
    .map((s) => s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
    .join(' / ');
}

interface CommentSidebarProps {
  comments: Comment[];
  memberNames: string[];
  currentBranch: string | null;
  currentPage: string;
  focusedCommentId: string | null;
  unreadIds: Set<string>;
  orphanedCommentIds?: Set<string>;
  onFocusComment: (id: string) => void;
  onMarkRead: (id: string) => void;
  onHoverComment?: (id: string | null) => void;
}

export function CommentSidebar({
  comments,
  memberNames: _memberNames,
  currentBranch,
  currentPage,
  focusedCommentId,
  unreadIds,
  orphanedCommentIds,
  onFocusComment,
  onMarkRead,
  onHoverComment,
}: CommentSidebarProps): React.ReactElement {
  const focusedRef = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<'open' | 'resolved'>('open');

  // Scroll focused comment into view when it changes
  useEffect(() => {
    if (focusedCommentId && focusedRef.current) {
      focusedRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [focusedCommentId]);

  const branchComments = comments.filter(
    (c) => !(c.branch && currentBranch && c.branch !== currentBranch),
  );
  const openCount = branchComments.filter((c) => c.status === 'open').length;
  const resolvedCount = branchComments.filter((c) => c.status === 'resolved').length;

  // Filter to active tab and current branch before grouping
  const visibleComments = comments.filter((c) => {
    if (c.status !== tab) return false;
    // Hide comments from other branches when we know both sides
    if (c.branch && currentBranch && c.branch !== currentBranch) return false;
    return true;
  });

  // Group visible comments by anchor.pageUrl
  const grouped = new Map<string, Comment[]>();
  for (const comment of visibleComments) {
    const page = comment.anchor?.pageUrl || '/';
    if (!grouped.has(page)) grouped.set(page, []);
    grouped.get(page)!.push(comment);
  }

  // Current page first, then alphabetically
  const pages = [...grouped.keys()].sort((a, b) => {
    if (a === currentPage) return -1;
    if (b === currentPage) return 1;
    return a.localeCompare(b);
  });

  return (
    <div
      className="flex flex-col shrink-0 overflow-hidden"
      style={{
        width: '280px',
        background: 'var(--vscode-sideBar-background, #252526)',
        borderLeft: '1px solid var(--vscode-panel-border, #444)',
      }}
    >
      {/* Header — segmented control */}
      <div
        className="flex items-center px-3 py-2 shrink-0"
        style={{ borderBottom: '1px solid var(--vscode-panel-border, #444)' }}
      >
        <h2 className="sr-only">Comments</h2>
        <div
          className="flex rounded overflow-hidden w-full text-xs"
          role="tablist"
          aria-label="Comment filter"
          style={{ border: '1px solid var(--vscode-panel-border, #444)' }}
        >
          {(['open', 'resolved'] as const).map((t) => {
            const label = t === 'open' ? 'Comments' : 'Resolved';
            const count = t === 'open' ? openCount : resolvedCount;
            const isActive = tab === t;
            return (
              <button
                key={t}
                role="tab"
                aria-selected={isActive}
                onClick={() => setTab(t)}
                className="flex-1 py-1 flex items-center justify-center gap-1"
                style={{
                  background: isActive ? '#FF6F00' : 'transparent',
                  color: isActive
                    ? 'var(--vscode-titleBar-activeBackground, #3c3c3c)'
                    : 'var(--vscode-foreground)',
                  opacity: isActive ? 1 : 0.5,
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {label}
                {count > 0 && (
                  <span
                    className="px-1 rounded-full"
                    style={{
                      background: isActive ? 'rgba(0,0,0,0.2)' : 'rgba(128,128,128,0.2)',
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Comment list */}
      <div className="flex-1 overflow-y-auto">
        {visibleComments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 text-center" style={{ minHeight: '120px' }}>
            <span className="text-xs opacity-30" style={{ color: 'var(--vscode-foreground)' }}>
              {comments.length === 0
                ? 'No comments yet. Enter comment mode and click any element to leave one.'
                : tab === 'open'
                  ? 'No open comments.'
                  : 'No resolved comments yet.'}
            </span>
          </div>
        ) : (
          pages.map((page) => {
            const pageComments = grouped.get(page)!;
            const isCurrentPage = page === currentPage;

            return (
              <div key={page}>
                {/* Page group header */}
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 sticky top-0"
                  style={{
                    background: 'var(--vscode-sideBar-background, #252526)',
                    borderBottom: '1px solid var(--vscode-panel-border, #333)',
                  }}
                >
                  {/* Link icon */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="10"
                    height="10"
                    fill={isCurrentPage ? '#FF6F00' : 'currentColor'}
                    viewBox="0 0 16 16"
                    aria-hidden="true"
                    style={{ opacity: isCurrentPage ? 1 : 0.4, flexShrink: 0 }}
                  >
                    <path d="M4.715 6.542 3.343 7.914a3 3 0 1 0 4.243 4.243l1.828-1.829A3 3 0 0 0 8.586 5.5L8 6.086a1.002 1.002 0 0 0-.154.199 2 2 0 0 1 .861 3.337L6.88 11.45a2 2 0 1 1-2.83-2.83l.793-.792a4.018 4.018 0 0 1-.128-1.287z" />
                    <path d="M6.586 4.672A3 3 0 0 0 7.414 9.5l.775-.776a2 2 0 0 1-.896-3.346L9.12 3.55a2 2 0 1 1 2.83 2.83l-.793.792c.112.42.155.855.128 1.287l1.372-1.372a3 3 0 1 0-4.243-4.243L6.586 4.672z" />
                  </svg>
                  <span
                    className="text-xs font-medium truncate"
                    style={{
                      color: isCurrentPage ? '#FF6F00' : 'var(--vscode-foreground)',
                      opacity: isCurrentPage ? 1 : 0.6,
                    }}
                    title={page}
                  >
                    {pageLabel(page)}
                  </span>
                  <span
                    className="text-xs ml-auto shrink-0 opacity-40"
                    style={{ color: 'var(--vscode-foreground)' }}
                  >
                    {pageComments.length}
                  </span>
                </div>

                {/* Comments in this page — newest first */}
                {[...pageComments]
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((comment) => {
                    const isFocused = focusedCommentId === comment.id;
                    const isUnread = unreadIds.has(comment.id);
                    const isOrphaned = orphanedCommentIds?.has(comment.id) ?? false;

                    return (
                      <button
                        key={comment.id}
                        ref={isFocused ? focusedRef : undefined}
                        className="px-3 py-2 w-full text-left"
                        style={{
                          background: isFocused ? 'rgba(255,111,0,0.08)' : 'transparent',
                          borderBottom: '1px solid var(--vscode-panel-border, #333)',
                          cursor: 'pointer',
                        }}
                        aria-label={`Comment by ${comment.author.name}: ${comment.body}`}
                        onMouseEnter={() => onHoverComment?.(comment.id)}
                        onMouseLeave={() => onHoverComment?.(null)}
                        onClick={() => {
                          onFocusComment(comment.id);
                          onMarkRead(comment.id);
                        }}
                      >
                        {/* Element label row */}
                        <div className="flex items-center gap-1 mb-0.5 min-w-0">
                          {isUnread && (
                            <span
                              aria-label="Unread"
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: '#FF6F00',
                                flexShrink: 0,
                                display: 'inline-block',
                              }}
                            />
                          )}
                          <span
                            className="text-xs truncate"
                            style={{ color: '#FF6F00', opacity: 0.8 }}
                            title={comment.anchor?.label}
                          >
                            {comment.anchor?.label}
                          </span>
                          {isOrphaned && (
                            <span
                              title="Element not found on this page"
                              aria-label="Element not found"
                              style={{ flexShrink: 0, display: 'inline-flex', color: 'var(--vscode-editorWarning-foreground, #f59e0b)' }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                                <path d="M7.938 2.016A.13.13 0 0 1 8.002 2a.13.13 0 0 1 .063.016.146.146 0 0 1 .054.057l6.857 11.667c.036.06.035.124.002.183a.163.163 0 0 1-.054.06.116.116 0 0 1-.066.017H1.146a.115.115 0 0 1-.066-.017.163.163 0 0 1-.054-.06.176.176 0 0 1 .002-.183L7.884 2.073a.147.147 0 0 1 .054-.057zm1.044-.45a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566z"/>
                                <path d="M7.002 12a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 5.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995z"/>
                              </svg>
                            </span>
                          )}
                          {comment.status === 'resolved' && (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="10"
                              height="10"
                              fill="#22c55e"
                              viewBox="0 0 16 16"
                              className="shrink-0 ml-auto"
                              aria-label="Resolved"
                              role="img"
                            >
                              <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z" />
                            </svg>
                          )}
                        </div>

                        {/* Body preview */}
                        <p
                          className="text-xs truncate"
                          style={{ color: 'var(--vscode-foreground)', opacity: 0.7 }}
                        >
                          {comment.body}
                        </p>

                        {/* Meta */}
                        <div className="flex items-center gap-2 mt-1 min-w-0">
                          <span
                            className="text-xs opacity-40 truncate"
                            style={{ color: 'var(--vscode-foreground)' }}
                          >
                            {comment.author.name}
                          </span>
                          {comment.replies.length > 0 && (
                            <span
                              className="text-xs opacity-40 shrink-0"
                              style={{ color: 'var(--vscode-foreground)' }}
                            >
                              · {comment.replies.length}{' '}
                              {comment.replies.length !== 1 ? 'replies' : 'reply'}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
