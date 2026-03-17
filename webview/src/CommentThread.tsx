import React, { useState } from 'react';
import { vscodeApi } from './vscode.js';
import { MentionTextarea } from './MentionTextarea.js';
import { parseMentions } from './utils.js';
import type { Comment } from './types.js';

interface CommentThreadProps {
  comment: Comment;
  memberNames: string[];
  onClose: () => void;
}

export function CommentThread({ comment, memberNames, onClose }: CommentThreadProps): React.ReactElement {
  const [replyBody, setReplyBody] = useState('');

  const submitReply = () => {
    if (!replyBody.trim()) return;
    const mentions = parseMentions(replyBody);
    vscodeApi.postMessage({ type: 'addReply', commentId: comment.id, body: replyBody.trim(), mentions });
    setReplyBody('');
  };

  const toggleStatus = () => {
    vscodeApi.postMessage({
      type: comment.status === 'open' ? 'resolveComment' : 'reopenComment',
      commentId: comment.id,
    });
    onClose();
  };

  return (
    <div
      className="z-50 w-full rounded-lg shadow-2xl flex flex-col"
      style={{
        maxHeight: '320px',
        background: 'var(--vscode-editorWidget-background, #252526)',
        border: '1px solid var(--vscode-panel-border, #454545)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 shrink-0"
        style={{ borderBottom: '1px solid var(--vscode-panel-border, #454545)' }}
      >
        <span className="text-xs font-medium truncate max-w-[180px]" title={comment.author.name}>
          {comment.author.name}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleStatus}
            className="text-xs px-2 py-0.5 rounded"
            title={comment.status === 'open' ? 'Mark resolved (R)' : 'Reopen (R)'}
            style={{
              background: comment.status === 'open'
                ? 'var(--vscode-button-secondaryBackground, #3a3d41)'
                : 'rgba(34,197,94,0.2)',
              color: comment.status === 'open'
                ? 'var(--vscode-button-secondaryForeground, #ccc)'
                : '#22c55e',
            }}
          >
            {comment.status === 'open' ? 'Resolve' : 'Reopen'}
          </button>
          <button
            onClick={() => vscodeApi.postMessage({ type: 'deleteComment', commentId: comment.id })}
            className="opacity-60 hover:opacity-100 flex items-center"
            title="Delete comment"
            aria-label="Delete comment"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
              <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
              <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
            </svg>
          </button>
          <button
            onClick={onClose}
            className="text-xs opacity-60 hover:opacity-100"
            title="Close"
            aria-label="Close comment thread"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Thread body — scrollable */}
      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-3">
        {/* Original comment */}
        <MessageBubble
          name={comment.author.name}
          body={comment.body}
          createdAt={comment.createdAt}
        />

        {/* Replies */}
        {comment.replies.map((reply) => (
          <MessageBubble
            key={reply.id}
            name={reply.author.name}
            body={reply.body}
            createdAt={reply.createdAt}
          />
        ))}
      </div>

      {/* Reply input */}
      {comment.status === 'open' && (
        <div
          className="px-3 py-2 shrink-0 flex flex-col gap-2"
          style={{ borderTop: '1px solid var(--vscode-panel-border, #454545)' }}
        >
          <MentionTextarea
            value={replyBody}
            onChange={setReplyBody}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitReply();
            }}
            knownNames={memberNames}
            placeholder="Reply... (type @ to mention, ⌘↵ to send)"
            aria-label="Reply to comment"
            rows={2}
            className="w-full resize-none text-xs rounded p-2 outline-none"
            style={{
              background: 'var(--vscode-input-background, #3c3c3c)',
              color: 'var(--vscode-input-foreground, #ccc)',
              border: '1px solid var(--vscode-input-border, #555)',
            }}
          />
          <button
            onClick={submitReply}
            disabled={!replyBody.trim()}
            className="self-end text-xs px-3 py-1 rounded disabled:opacity-40"
            style={{
              background: 'var(--vscode-button-background, #FF6F00)',
              color: 'var(--vscode-button-foreground, #fff)',
            }}
          >
            Reply
          </button>
        </div>
      )}
    </div>
  );
}

function MessageBubble({
  name,
  body,
  createdAt,
}: {
  name: string;
  body: string;
  createdAt: string;
}): React.ReactElement {
  const date = new Date(createdAt);
  const timeLabel = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    + ' ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-semibold">{name}</span>
        <span className="text-xs opacity-40">{timeLabel}</span>
      </div>
      <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">
        <MentionBody body={body} />
      </p>
    </div>
  );
}

/** Renders body text with @Name mentions highlighted as blue chips. */
function MentionBody({ body }: { body: string }): React.ReactElement {
  // Split on @Word patterns (greedy match up to whitespace or end)
  const parts = body.split(/(@\S+)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('@') && part.length > 1) {
          return (
            <span
              key={i}
              className="inline-block rounded px-1 text-xs font-medium"
              style={{
                background: 'rgba(255,111,0,0.2)',
                color: '#FF6F00',
              }}
            >
              {part}
            </span>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}
