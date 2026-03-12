import React, { useCallback, useEffect, useState } from 'react';
import { vscodeApi } from './vscode.js';
import { CommentThread } from './CommentThread.js';
import { MentionTextarea } from './MentionTextarea.js';
import { parseMentions } from './utils.js';
import type { Comment, Position } from './types.js';

interface DraftPin {
  x: number;
  y: number;
}

interface CommentOverlayProps {
  comments: Comment[];
  commentMode: boolean;
  pinsVisible: boolean;
  focusedPinId: string | null;
  memberNames: string[];
  onPinClick: (x: number, y: number) => void;
  onClearFocus: () => void;
}

export function CommentOverlay({
  comments,
  commentMode,
  pinsVisible,
  focusedPinId,
  memberNames,
  onPinClick,
  onClearFocus,
}: CommentOverlayProps): React.ReactElement {
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [draftPin, setDraftPin] = useState<DraftPin | null>(null);
  const [draftBody, setDraftBody] = useState('');

  // When a pin is focused from the sidebar, auto-open its thread
  useEffect(() => {
    if (focusedPinId) {
      setActiveCommentId(focusedPinId);
    }
  }, [focusedPinId]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!commentMode) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      setDraftPin({ x, y });
      setDraftBody('');
      onPinClick(x, y);
    },
    [commentMode, onPinClick],
  );

  const submitDraft = useCallback(() => {
    if (!draftPin || !draftBody.trim()) return;
    const position: Position = { x: draftPin.x, y: draftPin.y, scrollY: 0 };
    const mentions = parseMentions(draftBody);
    vscodeApi.postMessage({ type: 'addComment', position, body: draftBody.trim(), mentions });
    setDraftPin(null);
    setDraftBody('');
  }, [draftPin, draftBody]);

  const cancelDraft = useCallback(() => {
    setDraftPin(null);
    setDraftBody('');
  }, []);

  const handleActivate = useCallback((id: string) => {
    const next = activeCommentId === id ? null : id;
    setActiveCommentId(next);
    if (!next) onClearFocus();
  }, [activeCommentId, onClearFocus]);

  return (
    <div
      className="absolute inset-0"
      style={{ cursor: commentMode ? 'crosshair' : 'default', pointerEvents: 'auto' }}
      onClick={handleOverlayClick}
    >
      {/* Existing comment pins */}
      {pinsVisible && comments.map((comment) => (
        <CommentPin
          key={comment.id}
          comment={comment}
          isActive={activeCommentId === comment.id}
          isFocused={focusedPinId === comment.id}
          memberNames={memberNames}
          onActivate={() => handleActivate(comment.id)}
        />
      ))}

      {/* Draft pin — shown while typing a new comment */}
      {draftPin && (
        <div
          className="absolute"
          style={{ left: `${draftPin.x}%`, top: `${draftPin.y}%`, transform: 'translate(-50%, -50%)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold shadow-lg"
            style={{ background: 'var(--vscode-button-background, #FF6F00)', color: '#fff' }}>
            +
          </div>

          <div
            className="absolute z-50 w-64 rounded-lg shadow-xl p-3 flex flex-col gap-2"
            style={{
              top: '28px',
              left: '0',
              background: 'var(--vscode-editorWidget-background, #252526)',
              border: '1px solid var(--vscode-panel-border, #454545)',
            }}
          >
            <MentionTextarea
              autoFocus
              value={draftBody}
              onChange={setDraftBody}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitDraft();
                if (e.key === 'Escape') cancelDraft();
              }}
              knownNames={memberNames}
              placeholder="Leave a comment... (type @ to mention)"
              rows={3}
              className="w-full resize-none text-xs rounded p-2 outline-none"
              style={{
                background: 'var(--vscode-input-background, #3c3c3c)',
                color: 'var(--vscode-input-foreground, #ccc)',
                border: '1px solid var(--vscode-input-border, #555)',
              }}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={cancelDraft}
                className="text-xs px-2 py-1 rounded"
                style={{
                  background: 'var(--vscode-button-secondaryBackground, #3a3d41)',
                  color: 'var(--vscode-button-secondaryForeground, #ccc)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={submitDraft}
                disabled={!draftBody.trim()}
                className="text-xs px-2 py-1 rounded disabled:opacity-40"
                style={{
                  background: 'var(--vscode-button-background, #FF6F00)',
                  color: 'var(--vscode-button-foreground, #fff)',
                }}
              >
                Post (⌘↵)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface CommentPinProps {
  comment: Comment;
  isActive: boolean;
  isFocused: boolean;
  memberNames: string[];
  onActivate: () => void;
}

function CommentPin({ comment, isActive, isFocused, memberNames, onActivate }: CommentPinProps): React.ReactElement {
  const isResolved = comment.status === 'resolved';

  return (
    <div
      className="absolute"
      style={{
        left: `${comment.position.x}%`,
        top: `${comment.position.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: isActive ? 50 : 10,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onActivate();
      }}
    >
      {/* Pulse ring when focused from sidebar */}
      {isFocused && (
        <div
          className="absolute rounded-full animate-ping"
          style={{
            width: '32px',
            height: '32px',
            top: '-4px',
            left: '-4px',
            background: 'var(--vscode-button-background, #FF6F00)',
            opacity: 0.4,
          }}
        />
      )}

      {/* Pin marker */}
      <div
        className="w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer shadow-md transition-transform hover:scale-110"
        style={{
          background: isResolved ? '#22c55e' : 'var(--vscode-button-background, #FF6F00)',
          borderColor: isFocused ? '#fff' : 'rgba(255,255,255,0.6)',
          color: '#fff',
          opacity: isResolved ? 0.7 : 1,
        }}
        title={`${comment.author.name}: ${comment.body}`}
      >
        {isResolved ? '✓' : <span className="text-xs font-bold">{comment.replies.length + 1}</span>}
      </div>

      {/* Thread popover */}
      {isActive && (
        <div onClick={(e) => e.stopPropagation()}>
          <CommentThread comment={comment} memberNames={memberNames} onClose={onActivate} />
        </div>
      )}
    </div>
  );
}
