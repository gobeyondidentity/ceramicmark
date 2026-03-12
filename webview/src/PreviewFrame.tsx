import React, { useCallback, useEffect, useRef } from 'react';
import logoSvg from './ceramicmark_logo.svg?raw';
import { CommentOverlay } from './CommentOverlay.js';
import type { Comment } from './types.js';

interface PreviewFrameProps {
  url: string;
  comments: Comment[];
  commentMode: boolean;
  pinsVisible: boolean;
  focusedPinId: string | null;
  memberNames: string[];
  onCommentModeExit: () => void;
  onClearFocus: () => void;
}

export function PreviewFrame({
  url,
  comments,
  commentMode,
  pinsVisible,
  focusedPinId,
  memberNames,
  onCommentModeExit,
  onClearFocus,
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
    (_x: number, _y: number) => {
      if (!commentMode) return;
    },
    [commentMode],
  );

  if (!url) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <div
          style={{ width: '225px', filter: 'brightness(0) saturate(100%) invert(42%) sepia(99%) saturate(1200%) hue-rotate(2deg) brightness(103%)' }}
          dangerouslySetInnerHTML={{ __html: logoSvg.replace(/<svg /, '<svg width="225" height="auto" ') }}
        />
        <p className="text-xs opacity-40">Enter a localhost URL above and press Enter</p>
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
        focusedPinId={focusedPinId}
        memberNames={memberNames}
        onPinClick={handleOverlayClick}
        onClearFocus={onClearFocus}
      />

      {/* Comment mode cursor hint */}
      {commentMode && (
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs px-3 py-1.5 rounded-full pointer-events-none"
          style={{
            background: 'var(--vscode-button-background, #FF6F00)',
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
