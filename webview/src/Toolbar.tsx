import React, { useState } from 'react';
import logoSvg from './ceramicmark_logo.svg?raw';

interface ToolbarProps {
  previewUrl: string;
  commentMode: boolean;
  currentBranch: string | null;
  sidebarOpen: boolean;
  onUrlChange: (url: string) => void;
  onToggleCommentMode: () => void;
  onToggleSidebar: () => void;
}

export function Toolbar({
  previewUrl,
  commentMode,
  currentBranch,
  sidebarOpen,
  onUrlChange,
  onToggleCommentMode,
  onToggleSidebar,
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
          aria-hidden="true"
          style={{
            height: '18px',
            width: 'auto',
            display: 'flex',
            alignItems: 'center',
            filter:
              'brightness(0) saturate(100%) invert(42%) sepia(99%) saturate(1200%) hue-rotate(2deg) brightness(103%)',
          }}
          dangerouslySetInnerHTML={{
            __html: logoSvg
            .replace(/\s+width="[^"]*"/, '')
            .replace(/\s+height="[^"]*"/, '')
            .replace(/<svg /, '<svg height="18" style="width:auto;height:18px;" '),
          }}
        />

        {/* URL bar */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-1 justify-center items-center gap-1 min-w-0"
          aria-label="Navigate to URL"
        >
          <label htmlFor="toolbar-url-input" className="sr-only">Development server URL</label>
          <input
            id="toolbar-url-input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => {
              if (!inputValue) setInputValue('http://localhost:');
            }}
            placeholder="Enter Dev Server: ex http://localhost:3000 | Press Enter"
            className="w-full px-2 py-1 text-xs rounded outline-none placeholder-[#FF6F00]"
            style={{
              background: 'transparent',
              color: '#FF6F00',
              border: '1px solid #FF6F00',
            }}
          />
        </form>

        {/* Sidebar toggle */}
        <button
          onClick={onToggleSidebar}
          aria-pressed={sidebarOpen}
          aria-label={sidebarOpen ? 'Hide comments sidebar' : 'Show comments sidebar'}
          title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          className="shrink-0 flex items-center px-1.5 py-1 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          style={{
            color: sidebarOpen ? '#FF6F00' : 'var(--vscode-titleBar-activeForeground, #ccc)',
            opacity: sidebarOpen ? 1 : 0.5,
          }}
        >
          {/* Bootstrap Icon: layout-sidebar-reverse */}
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h11A1.5 1.5 0 0 1 15 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 13.5v-11zM2.5 2a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5H10v-12H2.5zm7.5 0v12h3.5a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5H10z"/>
          </svg>
        </button>

        {/* Comment mode toggle */}
        <button
          onClick={onToggleCommentMode}
          title={commentMode ? 'Exit comment mode (Esc)' : 'Toggle comment mode (C)'}
          aria-pressed={commentMode}
          aria-label={commentMode ? 'Exit comment mode' : 'Enter comment mode'}
          className="flex items-center gap-1.5 px-2 py-1 text-xs rounded shrink-0 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          style={{
            background: '#FF6F00',
            color: 'var(--vscode-titleBar-activeBackground, #3c3c3c)',
            opacity: commentMode ? 0.5 : 1,
            border: '1px solid transparent',
          }}
        >
          {/* Always-visible chat icon */}
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 15c4.418 0 8-3.134 8-7s-3.582-7-8-7-8 3.134-8 7c0 1.76.743 3.37 1.97 4.6-.097 1.016-.417 2.13-.771 2.966-.079.186.074.394.273.362 2.256-.37 3.597-.938 4.18-1.234A9.06 9.06 0 0 0 8 15z"/>
          </svg>
          <span className="hidden sm:inline">{commentMode ? 'Commenting' : 'Comment'}</span>
          {!commentMode && (
            <span
              className="hidden sm:inline text-xs rounded px-1"
              style={{
                background: 'rgba(0,0,0,0.2)',
                fontSize: '10px',
                lineHeight: '14px',
              }}
            >
              C
            </span>
          )}
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
