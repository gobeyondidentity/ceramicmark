import React, { useEffect, useRef } from 'react';
import type { Comment } from './types.js';

interface PreviewFrameProps {
  iframeUrl: string;
  displayUrl: string;
  commentMode: boolean;
  focusedComment: Comment | null;
  currentPage: string;
  onCommentModeExit: () => void;
}

export function PreviewFrame({
  iframeUrl,
  displayUrl,
  commentMode,
  focusedComment,
  currentPage,
  onCommentModeExit,
}: PreviewFrameProps): React.ReactElement {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Exit comment mode on Escape
  useEffect(() => {
    if (!commentMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCommentModeExit();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [commentMode, onCommentModeExit]);

  // Tell the iframe when comment mode changes
  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'cm-comment-mode', active: commentMode },
      '*',
    );
  }, [commentMode]);

  // Navigate to comment's page if not already there
  useEffect(() => {
    if (!focusedComment || !iframeUrl) return;
    const commentPage = focusedComment.anchor?.pageUrl ?? '/';
    if (commentPage !== currentPage && iframeRef.current) {
      iframeRef.current.src = iframeUrl + commentPage;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedComment]); // intentionally excludes currentPage — only navigate on new focus

  // Highlight the element once we're on the right page
  useEffect(() => {
    if (!focusedComment) return;
    const commentPage = focusedComment.anchor?.pageUrl ?? '/';
    if (currentPage !== commentPage) return; // not there yet, wait for navigation
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: 'cm-highlight-element',
        elementId: focusedComment.anchor?.elementId,
        testId: focusedComment.anchor?.testId,
        tag: focusedComment.anchor?.tag,
        text: focusedComment.anchor?.text,
      },
      '*',
    );
  }, [focusedComment, currentPage]);

  return (
    <div
      className="relative flex-1 overflow-hidden"
      style={commentMode ? { outline: '2px solid #FF6F00', outlineOffset: '-2px' } : undefined}
    >
      {iframeUrl ? (
        <iframe
          ref={iframeRef}
          src={iframeUrl}
          className="w-full h-full border-0"
          title="Design Preview"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        />
      ) : (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="text-xs" style={{ color: 'var(--vscode-foreground)', opacity: 0.5 }}>
              Connecting to{' '}
              <span style={{ color: '#FF6F00' }}>{displayUrl}</span>
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--vscode-foreground)', opacity: 0.3 }}>
              Starting proxy...
            </div>
          </div>
        </div>
      )}

      {/* Comment mode hint */}
      {commentMode && (
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs px-3 py-1.5 rounded-full pointer-events-none"
          style={{
            background: '#FF6F00',
            color: 'var(--vscode-titleBar-activeBackground, #3c3c3c)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}
        >
          Click any element to comment · Esc to cancel
        </div>
      )}
    </div>
  );
}
