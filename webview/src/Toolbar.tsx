import React, { useState } from 'react';
import logoSvg from './ceramicmark_logo.svg?raw';

interface ToolbarProps {
  previewUrl: string;
  commentMode: boolean;
  pinsVisible: boolean;
  onUrlChange: (url: string) => void;
  onToggleCommentMode: () => void;
  onTogglePinsVisible: () => void;
}

export function Toolbar({
  previewUrl,
  commentMode,
  pinsVisible,
  onUrlChange,
  onToggleCommentMode,
  onTogglePinsVisible,
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
      {/* Logo */}
      <div
        className="shrink-0"
        style={{ height: '18px', width: 'auto', display: 'flex', alignItems: 'center', filter: 'brightness(0) saturate(100%) invert(42%) sepia(99%) saturate(1200%) hue-rotate(2deg) brightness(103%)' }}
        dangerouslySetInnerHTML={{ __html: logoSvg.replace(/<svg /, '<svg height="18" width="auto" ') }}
      />

      {/* URL bar */}
      <form onSubmit={handleSubmit} className="flex flex-1 items-center gap-1 min-w-0">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="http://localhost:3000 · press Enter"
          className="flex-1 px-2 py-1 text-xs rounded min-w-0 outline-none placeholder-[#FF6F00]"
          style={{
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

      {/* Hide/show pins toggle */}
      <button
        onClick={onTogglePinsVisible}
        title={pinsVisible ? 'Hide comment pins' : 'Show comment pins'}
        className="flex items-center gap-1 px-2 py-1 text-xs rounded shrink-0 transition-colors"
        style={{
          background: 'var(--vscode-button-secondaryBackground, #3a3d41)',
          color: pinsVisible
            ? 'var(--vscode-button-secondaryForeground, #ccc)'
            : 'var(--vscode-disabledForeground, #666)',
          border: '1px solid transparent',
        }}
      >
        {pinsVisible ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="#FF6F00" viewBox="0 0 16 16">
            <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/>
            <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="#FF6F00" viewBox="0 0 16 16" opacity="0.4">
            <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/>
            <path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z"/>
            <path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12-.708.708z"/>
          </svg>
        )}
      </button>

    </div>
  );
}
