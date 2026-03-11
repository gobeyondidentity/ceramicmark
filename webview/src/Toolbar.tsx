import React, { useState } from 'react';
import type { Author } from './types.js';

interface ToolbarProps {
  previewUrl: string;
  commentMode: boolean;
  identity: Author | null;
  onUrlChange: (url: string) => void;
  onToggleCommentMode: () => void;
}

export function Toolbar({
  previewUrl,
  commentMode,
  identity,
  onUrlChange,
  onToggleCommentMode,
}: ToolbarProps): React.ReactElement {
  const [inputValue, setInputValue] = useState(previewUrl);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const url = inputValue.trim();
    if (url) {
      onUrlChange(url.startsWith('http') ? url : `http://${url}`);
    }
  };

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 shrink-0"
      style={{
        background: 'var(--vscode-titleBar-activeBackground, #3c3c3c)',
        borderBottom: '1px solid var(--vscode-panel-border, #444)',
      }}
    >
      {/* URL bar */}
      <form onSubmit={handleSubmit} className="flex flex-1 items-center gap-1 min-w-0">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="http://localhost:3000"
          className="flex-1 px-2 py-1 text-xs rounded min-w-0 outline-none"
          style={{
            background: 'var(--vscode-input-background, #3c3c3c)',
            color: 'var(--vscode-input-foreground, #cccccc)',
            border: '1px solid var(--vscode-input-border, #555)',
          }}
        />
        <button
          type="submit"
          className="px-2 py-1 text-xs rounded shrink-0"
          style={{
            background: 'var(--vscode-button-background, #0e639c)',
            color: 'var(--vscode-button-foreground, #ffffff)',
          }}
        >
          Go
        </button>
      </form>

      {/* Comment mode toggle */}
      <button
        onClick={onToggleCommentMode}
        title={commentMode ? 'Exit comment mode (Esc)' : 'Add comment (click on preview)'}
        className="flex items-center gap-1 px-2 py-1 text-xs rounded shrink-0 transition-colors"
        style={{
          background: commentMode
            ? 'var(--vscode-button-background, #0e639c)'
            : 'var(--vscode-button-secondaryBackground, #3a3d41)',
          color: commentMode
            ? 'var(--vscode-button-foreground, #fff)'
            : 'var(--vscode-button-secondaryForeground, #ccc)',
          border: commentMode ? '1px solid var(--vscode-focusBorder, #007fd4)' : '1px solid transparent',
        }}
      >
        <span>{commentMode ? '✦' : '+'}</span>
        <span>{commentMode ? 'Commenting' : 'Comment'}</span>
      </button>

      {/* Identity badge */}
      {identity && (
        <div
          className="text-xs px-2 py-1 rounded shrink-0 opacity-70"
          title={identity.email}
          style={{ background: 'var(--vscode-badge-background, #4d4d4d)', color: 'var(--vscode-badge-foreground, #fff)' }}
        >
          {identity.name.split(' ')[0]}
        </div>
      )}
    </div>
  );
}
