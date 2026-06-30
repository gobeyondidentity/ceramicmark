import React, { useState } from 'react';
import { vscodeApi } from './vscode.js';
import { MentionTextarea } from './MentionTextarea.js';
import { parseMentions } from './utils.js';
import type { Comment } from './types.js';

interface CommentThreadProps {
  comment: Comment;
  memberNames: string[];
  orphaned?: boolean;
  onClose: () => void;
}

export function CommentThread({ comment, memberNames, orphaned, onClose }: CommentThreadProps): React.ReactElement {
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
            onClick={onClose}
            className="text-xs opacity-60 hover:opacity-100"
            title="Close"
            aria-label="Close comment thread"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Orphaned anchor tag — the element this comment was attached to is no longer in the page */}
      {orphaned && (
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 shrink-0"
          style={{ background: 'rgba(255,111,0,0.12)', borderBottom: '1px solid var(--vscode-panel-border, #454545)', color: '#FF6F00' }}
          title="The element this comment was anchored to is no longer present on this page."
        >
          {/* Bootstrap Icon: exclamation-triangle */}
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M7.938 2.016A.13.13 0 0 1 8.002 2a.13.13 0 0 1 .063.016.146.146 0 0 1 .054.057l6.857 11.667c.036.06.035.124.002.183a.163.163 0 0 1-.054.06.116.116 0 0 1-.066.017H1.146a.115.115 0 0 1-.066-.017.163.163 0 0 1-.054-.06.176.176 0 0 1 .002-.183L7.884 2.073a.147.147 0 0 1 .054-.057zm1.044-.45a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566z"/>
            <path d="M7.002 12a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 5.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995z"/>
          </svg>
          <span className="text-xs">Element no longer exists</span>
        </div>
      )}

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

      {/* Footer: reply input (open only) + delete/reply action row */}
      <div
        className="px-3 py-2 shrink-0 flex flex-col gap-2"
        style={{ borderTop: '1px solid var(--vscode-panel-border, #454545)' }}
      >
        {comment.status === 'open' && (
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
        )}
        <div className="flex items-center justify-between">
          <button
            onClick={() => vscodeApi.postMessage({ type: 'deleteComment', commentId: comment.id })}
            className="opacity-40 hover:opacity-100 flex items-center"
            title="Delete comment"
            aria-label="Delete comment"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
              <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
              <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
            </svg>
          </button>
          {comment.status === 'open' && (
            <button
              onClick={submitReply}
              disabled={!replyBody.trim()}
              className="text-xs px-3 py-1 rounded disabled:opacity-40"
              style={{
                background: 'var(--vscode-button-background, #FF6F00)',
                color: 'var(--vscode-button-foreground, #fff)',
              }}
            >
              Reply
            </button>
          )}
        </div>
      </div>
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
