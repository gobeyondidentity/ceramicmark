import React, { useEffect, useRef } from 'react';
import type { Comment } from './types.js';

interface PreviewFrameProps {
  iframeUrl: string;
  displayUrl: string;
  commentMode: boolean;
  focusedComment: Comment | null;
  focusCommentTs: number;
  currentPage: string;
  currentTitle: string;
  iframeReadyAt: number;
  comments: Comment[];
  connectionFailed: boolean;
  onCommentModeExit: () => void;
  onRetryUrl: () => void;
}

export function PreviewFrame({
  iframeUrl,
  displayUrl,
  commentMode,
  focusedComment,
  focusCommentTs,
  currentPage,
  currentTitle,
  iframeReadyAt,
  comments,
  connectionFailed,
  onCommentModeExit,
  onRetryUrl,
}: PreviewFrameProps): React.ReactElement {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Refs so callbacks always see the latest values without being recreated
  const focusedCommentRef = useRef(focusedComment);
  const commentsRef = useRef(comments);
  const currentPageRef = useRef(currentPage);
  const currentTitleRef = useRef(currentTitle);
  useEffect(() => { focusedCommentRef.current = focusedComment; }, [focusedComment]);
  useEffect(() => { commentsRef.current = comments; }, [comments]);
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);
  useEffect(() => { currentTitleRef.current = currentTitle; }, [currentTitle]);

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

  // Send all markers when comment data changes (new comment added, deleted, etc.)
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

  // Send page-filtered markers when the companion script signals it's ready
  // (iframeReadyAt updates every time cm-navigate fires, which the companion script
  // sends after registering all its listeners — so the message is never lost to a race).
  useEffect(() => {
    if (!iframeReadyAt) return;
    const markerData = commentsRef.current
      .filter((c) => {
        if ((c.anchor?.pageUrl ?? '/') !== currentPageRef.current) return false;
        // If the comment has a pageTitle and we know the current title, only show it on the
        // matching view (handles React-state apps where URL stays at '/' across all sections).
        const commentTitle = c.anchor?.pageTitle;
        const curTitle = currentTitleRef.current;
        if (commentTitle && curTitle && commentTitle !== curTitle) return false;
        return true;
      })
      .map((c) => ({
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
    const fc = focusedCommentRef.current;
    if (fc) {
      iframeRef.current?.contentWindow?.postMessage(
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
  }, [iframeReadyAt]);

  // Navigate to the comment's page (or highlight immediately if already there).
  // Triggers on every FOCUS_COMMENT dispatch via focusCommentTs — this ensures
  // re-clicking the same sidebar comment always re-navigates, even if focusedComment
  // hasn't changed. Uses refs so the effect always sees the latest page + comment.
  useEffect(() => {
    if (!iframeUrl) return;
    const fc = focusedCommentRef.current;
    if (!fc) {
      iframeRef.current?.contentWindow?.postMessage({ type: 'cm-clear-highlight' }, '*');
      return;
    }
    const commentPage = fc.anchor?.pageUrl ?? '/';
    if (commentPage !== currentPageRef.current) {
      // Change src — handleIframeLoad will send markers + highlight once the DOM is ready
      if (iframeRef.current) {
        iframeRef.current.src = iframeUrl + commentPage;
      }
    } else {
      // Already on the right page — highlight now
      iframeRef.current?.contentWindow?.postMessage(
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
  }, [focusCommentTs, iframeUrl]);

  // After iframe page load (MPA): DOM is ready, React has rendered — send all markers
  // and the focused comment highlight. Unfiltered so the companion script can match
  // any element that exists in the current DOM; non-matching anchors are silently skipped.
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

      {/* Connection failed overlay */}
      {connectionFailed && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: 'var(--vscode-editor-background)', zIndex: 10 }}
          role="status"
          aria-live="polite"
        >
          <div className="text-center px-6" style={{ maxWidth: '320px' }}>
            {/* Warning icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              fill="#FF6F00"
              viewBox="0 0 16 16"
              aria-hidden="true"
              style={{ margin: '0 auto 12px' }}
            >
              <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
            </svg>
            <div className="text-sm mb-1" style={{ color: 'var(--vscode-foreground)' }}>
              Can't reach dev server
            </div>
            <div className="text-xs mb-3" style={{ color: '#FF6F00' }}>
              {displayUrl}
            </div>
            <div className="text-xs mb-5" style={{ color: 'var(--vscode-foreground)', opacity: 0.5, lineHeight: 1.6 }}>
              Make sure your dev server is running, then wait — CeramicMark retries automatically.
            </div>
            <button
              onClick={onRetryUrl}
              className="text-xs px-3 py-1.5 rounded focus-visible:outline focus-visible:outline-2"
              style={{
                background: 'transparent',
                border: '1px solid #FF6F00',
                color: '#FF6F00',
                cursor: 'pointer',
              }}
              aria-label="Change the dev server URL"
            >
              Change URL
            </button>
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
