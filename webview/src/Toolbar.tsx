import React, { useState } from 'react';
import logoSvg from './ceramicmark_logo.svg?raw';

interface ToolbarProps {
  previewUrl: string;
  commentMode: boolean;
  currentBranch: string | null;
  onUrlChange: (url: string) => void;
  onToggleCommentMode: () => void;
}

export function Toolbar({
  previewUrl,
  commentMode,
  currentBranch,
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
      className="flex flex-col shrink-0"
      style={{
        background: 'var(--vscode-titleBar-activeBackground, #3c3c3c)',
        borderBottom: '1px solid var(--vscode-panel-border, #444)',
      }}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Logo */}
        <div
          className="shrink-0"
          style={{
            height: '18px',
            width: 'auto',
            display: 'flex',
            alignItems: 'center',
            filter:
              'brightness(0) saturate(100%) invert(42%) sepia(99%) saturate(1200%) hue-rotate(2deg) brightness(103%)',
          }}
          dangerouslySetInnerHTML={{
            __html: logoSvg.replace(/<svg /, '<svg height="18" '),
          }}
        />

        {/* URL bar */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-1 justify-center items-center gap-1 min-w-0"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => {
              if (!inputValue) setInputValue('http://localhost:');
            }}
            placeholder="Enter Dev Server: ex http://localhost:3000 | Press Enter"
            className="px-2 py-1 text-xs rounded outline-none placeholder-[#FF6F00]"
            style={{
              width: '420px',
              background: 'transparent',
              color: '#FF6F00',
              border: '1px solid #FF6F00',
            }}
          />
        </form>

        {/* Comment mode toggle */}
        <button
          onClick={onToggleCommentMode}
          title={commentMode ? 'Exit comment mode (Esc)' : 'Add comment (click on preview)'}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded shrink-0 transition-colors"
          style={{
            background: '#FF6F00',
            color: 'var(--vscode-titleBar-activeBackground, #3c3c3c)',
            opacity: commentMode ? 1 : 0.75,
            border: '1px solid transparent',
          }}
        >
          <span>{commentMode ? '✦' : '+'}</span>
          <span>{commentMode ? 'Commenting' : 'Comment'}</span>
        </button>
      </div>

      {/* Branch sub-row */}
      {currentBranch && (
        <div
          className="flex items-center gap-1 px-3 py-1"
          style={{ background: '#FF6F00' }}
        >
          <span
            className="text-xs"
            style={{ color: 'var(--vscode-titleBar-activeBackground, #3c3c3c)' }}
          >
            Current Branch: ⎇ {currentBranch}
          </span>
        </div>
      )}
    </div>
  );
}
