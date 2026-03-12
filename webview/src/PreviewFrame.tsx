import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  unreadIds: Set<string>;
  currentBranch: string | null;
  onCommentModeExit: () => void;
  onClearFocus: () => void;
  onMarkRead: (commentId: string) => void;
}

export function PreviewFrame({
  url,
  comments,
  commentMode,
  pinsVisible,
  focusedPinId,
  memberNames,
  unreadIds,
  currentBranch,
  onCommentModeExit,
  onClearFocus,
  onMarkRead,
}: PreviewFrameProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Track container dimensions so pins reposition correctly on panel resize
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setContainerSize({ width, height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

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
    const bgUri = document.querySelector<HTMLMetaElement>('meta[name="cm-bg"]')?.content;
    return (
      <div
        className="flex flex-1 flex-col items-center justify-center gap-4"
        style={bgUri ? { backgroundImage: `url(${bgUri})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      >
        <div
          style={{ width: '282px', filter: 'brightness(0) invert(1)' }}
          dangerouslySetInnerHTML={{ __html: logoSvg.replace(/<svg /, '<svg width="282" height="auto" ') }}
        />
        <p className="text-xs" style={{ color: '#fff' }}>Enter a localhost URL above and press Enter</p>
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
        containerSize={containerSize}
        unreadIds={unreadIds}
        currentBranch={currentBranch}
        onPinClick={handleOverlayClick}
        onClearFocus={onClearFocus}
        onMarkRead={onMarkRead}
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
