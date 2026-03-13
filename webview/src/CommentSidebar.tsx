import React, { useEffect, useState } from 'react';
import { CommentForm } from './CommentForm.js';
import { CommentThread } from './CommentThread.js';
import type { Comment, ElementAnchor } from './types.js';

interface CommentSidebarProps {
  comments: Comment[];
  pendingAnchor: Partial<ElementAnchor> | null;
  memberNames: string[];
  currentBranch: string | null;
  currentPage: string;
  focusedCommentId: string | null;
  unreadIds: Set<string>;
  onCancelPending: () => void;
  onFocusComment: (id: string) => void;
  onMarkRead: (id: string) => void;
}

export function CommentSidebar({
  comments,
  pendingAnchor,
  memberNames,
  currentBranch,
  currentPage,
  focusedCommentId,
  unreadIds,
  onCancelPending,
  onFocusComment,
  onMarkRead,
}: CommentSidebarProps): React.ReactElement {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // When a comment is focused from the extension sidebar, expand it
  useEffect(() => {
    if (focusedCommentId) {
      setExpandedId(focusedCommentId);
      onMarkRead(focusedCommentId);
    }
  }, [focusedCommentId]);

  // Group comments by anchor.pageUrl
  const grouped = new Map<string, Comment[]>();
  for (const comment of comments) {
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

  const openCount = comments.filter((c) => c.status === 'open').length;

  return (
    <div
      className="flex flex-col shrink-0 overflow-hidden"
      style={{
        width: '280px',
        background: 'var(--vscode-sideBar-background, #252526)',
        borderLeft: '1px solid var(--vscode-panel-border, #444)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 shrink-0"
        style={{ borderBottom: '1px solid var(--vscode-panel-border, #444)' }}
      >
        <span className="text-xs font-medium" style={{ color: 'var(--vscode-foreground)' }}>
          Comments
        </span>
        {openCount > 0 && (
          <span
            className="px-1.5 rounded-full text-xs"
            style={{
              background: '#FF6F00',
              color: 'var(--vscode-titleBar-activeBackground, #3c3c3c)',
            }}
          >
            {openCount}
          </span>
        )}
      </div>

      {/* Pending comment form */}
      {pendingAnchor && (
        <CommentForm
          anchor={pendingAnchor}
          memberNames={memberNames}
          onCancel={onCancelPending}
        />
      )}

      {/* Comment list */}
      <div className="flex-1 overflow-y-auto">
        {comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 text-center" style={{ minHeight: '120px' }}>
            <span className="text-xs opacity-30" style={{ color: 'var(--vscode-foreground)' }}>
              No comments yet. Enter comment mode and click any element to leave one.
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
                    {page}
                  </span>
                  <span
                    className="text-xs ml-auto shrink-0 opacity-40"
                    style={{ color: 'var(--vscode-foreground)' }}
                  >
                    {pageComments.length}
                  </span>
                </div>

                {/* Comments in this page */}
                {[...pageComments]
                  .sort((a, b) => {
                    if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                  })
                  .map((comment) => {
                    const isExpanded = expandedId === comment.id;
                    const isOffBranch = !!(
                      comment.branch && currentBranch && comment.branch !== currentBranch
                    );
                    const isUnread = unreadIds.has(comment.id);

                    return (
                      <div key={comment.id}>
                        {/* Comment card */}
                        <div
                          className="px-3 py-2 cursor-pointer"
                          style={{
                            background: isExpanded
                              ? 'rgba(255,111,0,0.08)'
                              : 'transparent',
                            borderBottom: '1px solid var(--vscode-panel-border, #333)',
                            opacity: isOffBranch ? 0.5 : 1,
                          }}
                          onClick={() => {
                            const next = isExpanded ? null : comment.id;
                            setExpandedId(next);
                            if (next) {
                              onFocusComment(next);
                              onMarkRead(next);
                            }
                          }}
                        >
                          {/* Element label row */}
                          <div className="flex items-center gap-1 mb-0.5 min-w-0">
                            {isUnread && (
                              <span
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
                            {comment.status === 'resolved' && (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="10"
                                height="10"
                                fill="#22c55e"
                                viewBox="0 0 16 16"
                                className="shrink-0 ml-auto"
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
                            {isOffBranch && (
                              <span
                                className="text-xs opacity-30 shrink-0 ml-auto truncate"
                                style={{ color: 'var(--vscode-foreground)' }}
                              >
                                {comment.branch}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Expanded thread */}
                        {isExpanded && (
                          <div
                            className="px-2 py-2"
                            style={{ background: 'var(--vscode-editor-background, #1e1e1e)' }}
                          >
                            <CommentThread
                              comment={comment}
                              memberNames={memberNames}
                              onClose={() => setExpandedId(null)}
                            />
                          </div>
                        )}
                      </div>
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
