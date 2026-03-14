import React, { useEffect, useRef } from 'react';
import type { Comment } from './types.js';

interface PreviewFrameProps {
  iframeUrl: string;
  displayUrl: string;
  commentMode: boolean;
  focusedComment: Comment | null;
  currentPage: string;
  comments: Comment[];
  onCommentModeExit: () => void;
}

export function PreviewFrame({
  iframeUrl,
  displayUrl,
  commentMode,
  focusedComment,
  currentPage,
  comments,
  onCommentModeExit,
}: PreviewFrameProps): React.ReactElement {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Refs so the onLoad handler always sees the latest values without being recreated
  const focusedCommentRef = useRef(focusedComment);
  const commentsRef = useRef(comments);
  useEffect(() => { focusedCommentRef.current = focusedComment; }, [focusedComment]);
  useEffect(() => { commentsRef.current = comments; }, [comments]);

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

  // Send markers when comments change while on the same page
  useEffect(() => {
    const markerData = comments.map((c) => ({
      id: c.id,
      elementId: c.anchor?.elementId,
      testId: c.anchor?.testId,
      tag: c.anchor?.tag,
      text: c.anchor?.text,
      cssPath: c.anchor?.cssPath,
      status: c.status,
    }));
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'cm-update-markers', comments: markerData },
      '*',
    );
  }, [comments]);

  // Navigate to the comment's page, or highlight immediately if already there
  useEffect(() => {
    if (!focusedComment || !iframeUrl) return;
    const commentPage = focusedComment.anchor?.pageUrl ?? '/';
    if (commentPage !== currentPage) {
      // Change src — onLoad will send the highlight once the DOM is ready
      if (iframeRef.current) {
        iframeRef.current.src = iframeUrl + commentPage;
      }
    } else {
      // Already on the right page, DOM is ready — highlight now
      iframeRef.current?.contentWindow?.postMessage(
        {
          type: 'cm-highlight-element',
          elementId: focusedComment.anchor?.elementId,
          testId: focusedComment.anchor?.testId,
          tag: focusedComment.anchor?.tag,
          text: focusedComment.anchor?.text,
          cssPath: focusedComment.anchor?.cssPath,
        },
        '*',
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedComment]); // intentionally omits currentPage — only re-run on new focus

  // After every iframe page load the DOM is guaranteed ready.
  // Re-send markers and, if a comment is focused, its highlight.
  const handleIframeLoad = () => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;

    const markerData = commentsRef.current.map((c) => ({
      id: c.id,
      elementId: c.anchor?.elementId,
      testId: c.anchor?.testId,
      tag: c.anchor?.tag,
      text: c.anchor?.text,
      cssPath: c.anchor?.cssPath,
      status: c.status,
    }));
    win.postMessage({ type: 'cm-update-markers', comments: markerData }, '*');

    const fc = focusedCommentRef.current;
    if (fc) {
      win.postMessage(
        {
          type: 'cm-highlight-element',
          elementId: fc.anchor?.elementId,
          testId: fc.anchor?.testId,
          tag: fc.anchor?.tag,
          text: fc.anchor?.text,
          cssPath: fc.anchor?.cssPath,
        },
        '*',
      );
    }
  };

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
          onLoad={handleIframeLoad}
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
