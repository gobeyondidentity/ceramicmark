import React, { useCallback, useEffect, useRef } from 'react';
import { CommentOverlay } from './CommentOverlay.js';
import type { Comment } from './types.js';

interface PreviewFrameProps {
  url: string;
  comments: Comment[];
  commentMode: boolean;
  pinsVisible: boolean;
  onCommentModeExit: () => void;
}

export function PreviewFrame({
  url,
  comments,
  commentMode,
  pinsVisible,
  onCommentModeExit,
}: PreviewFrameProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);

  // Exit comment mode on Escape
  useEffect(() => {
    if (!commentMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCommentModeExit();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [commentMode, onCommentModeExit]);

  const handleOverlayClick = useCallback(
    (x: number, y: number) => {
      if (!commentMode) return;
      // x, y are already percentages from CommentOverlay
      // The draft comment dialog is shown by the overlay
    },
    [commentMode],
  );

  if (!url) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 opacity-50">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
        <p className="text-sm">Enter a localhost URL above to load your app preview</p>
        <p className="text-xs opacity-60">Then click "Comment" to start leaving pins</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative flex-1 overflow-hidden">
      {/* The live preview iframe */}
      <iframe
        src={url}
        className="w-full h-full border-0"
        title="Design Preview"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        style={{ pointerEvents: commentMode ? 'none' : 'auto' }}
      />

      {/* Comment overlay — sits on top, captures clicks in comment mode */}
      <CommentOverlay
        comments={comments}
        commentMode={commentMode}
        pinsVisible={pinsVisible}
        onPinClick={handleOverlayClick}
      />

      {/* Comment mode cursor hint */}
      {commentMode && (
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs px-3 py-1.5 rounded-full pointer-events-none"
          style={{
            background: 'var(--vscode-button-background, #0e639c)',
            color: 'var(--vscode-button-foreground, #fff)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}
        >
          Click anywhere to leave a comment · Esc to cancel
        </div>
      )}
    </div>
  );
}
