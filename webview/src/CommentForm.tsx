import React, { useState } from 'react';
import { vscodeApi } from './vscode.js';
import { MentionTextarea } from './MentionTextarea.js';
import { parseMentions } from './utils.js';
import type { ElementAnchor } from './types.js';

interface CommentFormProps {
  anchor: Partial<ElementAnchor>;
  memberNames: string[];
  onCancel: () => void;
}

export function CommentForm({ anchor, memberNames, onCancel }: CommentFormProps): React.ReactElement {
  const [label, setLabel] = useState(anchor.label ?? '');
  const [body, setBody] = useState('');

  const submit = () => {
    if (!body.trim()) return;
    const finalAnchor: ElementAnchor = {
      pageUrl: anchor.pageUrl ?? '/',
      label: label.trim() || (anchor.label ?? ''),
      tag: anchor.tag,
      elementId: anchor.elementId,
      testId: anchor.testId,
      text: anchor.text,
      cssPath: anchor.cssPath,
    };
    const mentions = parseMentions(body);
    vscodeApi.postMessage({ type: 'addComment', anchor: finalAnchor, body: body.trim(), mentions });
    setBody('');
  };

  return (
    <div
      className="flex flex-col gap-2 p-3 shrink-0"
      style={{ borderBottom: '1px solid var(--vscode-panel-border, #444)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: '#FF6F00' }}>
          New Comment
        </span>
        <button
          onClick={onCancel}
          className="text-xs opacity-50 hover:opacity-100"
          style={{ color: 'var(--vscode-foreground)' }}
          title="Cancel"
          aria-label="Cancel new comment"
        >
          ✕
        </button>
      </div>

      {/* Element label */}
      <div className="flex flex-col gap-1">
        <label htmlFor="comment-form-label" className="text-xs opacity-40" style={{ color: 'var(--vscode-foreground)' }}>
          {anchor.pageUrl ?? '/'}
        </label>
        <input
          id="comment-form-label"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          aria-label="Element label"
          className="px-2 py-1 text-xs rounded outline-none"
          style={{
            background: 'var(--vscode-input-background, #3c3c3c)',
            color: 'var(--vscode-input-foreground, #ccc)',
            border: '1px solid #FF6F00',
          }}
        />
      </div>

      {/* Comment body */}
      <MentionTextarea
        autoFocus
        value={body}
        onChange={setBody}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
          if (e.key === 'Escape') onCancel();
        }}
        knownNames={memberNames}
        placeholder="Leave a comment... (type @ to mention)"
        aria-label="Comment body"
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
          onClick={onCancel}
          className="text-xs px-2 py-1 rounded"
          style={{
            background: 'var(--vscode-button-secondaryBackground, #3a3d41)',
            color: 'var(--vscode-button-secondaryForeground, #ccc)',
          }}
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={!body.trim()}
          className="text-xs px-2 py-1 rounded disabled:opacity-40"
          style={{
            background: '#FF6F00',
            color: 'var(--vscode-titleBar-activeBackground, #3c3c3c)',
          }}
        >
          Post (⌘↵)
        </button>
      </div>
    </div>
  );
}
