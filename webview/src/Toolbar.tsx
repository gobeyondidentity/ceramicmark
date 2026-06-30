import React, { useEffect, useRef, useState } from 'react';
import logoSvg from './ceramicmark_logo.svg?raw';

interface ToolbarProps {
  previewUrl: string;
  commentMode: boolean;
  currentBranch: string | null;
  sidebarOpen: boolean;
  pinsVisible: boolean;
  previewMode: 'proxy' | 'cdp';
  onModeChange: (mode: 'proxy' | 'cdp') => void;
  onUrlChange: (url: string) => void;
  onRefresh: () => void;
  onBack: () => void;
  onForward: () => void;
  onTogglePins: () => void;
  onToggleCommentMode: () => void;
  onToggleSidebar: () => void;
}

export function Toolbar({
  previewUrl,
  commentMode,
  currentBranch,
  sidebarOpen,
  pinsVisible,
  previewMode,
  onModeChange,
  onUrlChange,
  onRefresh,
  onBack,
  onForward,
  onTogglePins,
  onToggleCommentMode,
  onToggleSidebar,
}: ToolbarProps): React.ReactElement {
  const [inputValue, setInputValue] = useState(previewUrl);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the address bar in sync with live in-iframe navigation, but never clobber
  // what the user is actively typing.
  useEffect(() => {
    if (document.activeElement !== inputRef.current) setInputValue(previewUrl);
  }, [previewUrl]);

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

        {/* Browser navigation (Browser mode only) — keeps the user from getting stranded */}
        {previewMode === 'cdp' && (
          <div className="shrink-0 flex items-center gap-0.5">
            <button
              type="button"
              onClick={onBack}
              title="Back"
              aria-label="Go back"
              className="flex items-center px-1 py-1 rounded hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              style={{ color: '#FF6F00' }}
            >
              {/* Bootstrap Icon: arrow-left */}
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                <path fillRule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z"/>
              </svg>
            </button>
            <button
              type="button"
              onClick={onForward}
              title="Forward"
              aria-label="Go forward"
              className="flex items-center px-1 py-1 rounded hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              style={{ color: '#FF6F00' }}
            >
              {/* Bootstrap Icon: arrow-right */}
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                <path fillRule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z"/>
              </svg>
            </button>
          </div>
        )}

        {/* URL bar */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-1 justify-center items-center gap-1 min-w-0"
          aria-label="Navigate to URL"
        >
          <label htmlFor="toolbar-url-input" className="sr-only">Development server URL</label>
          <input
            id="toolbar-url-input"
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => {
              if (!inputValue) setInputValue('http://localhost:');
            }}
            placeholder="localhost:"
            className="w-full px-2 py-1 text-xs rounded outline-none placeholder-[#FF6F00]"
            style={{
              background: 'transparent',
              color: '#FF6F00',
              border: '1px solid #FF6F00',
            }}
          />
          <button
            type="button"
            onClick={onRefresh}
            title="Reload the previewed page (⌘R)"
            aria-label="Refresh preview"
            className="shrink-0 flex items-center px-1 py-1 rounded hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            style={{ color: '#FF6F00' }}
          >
            {/* Bootstrap Icon: arrow-repeat */}
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"/>
              <path fillRule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z"/>
            </svg>
          </button>
        </form>

        {/* Preview mode toggle: Proxy / Browser */}
        <div
          role="radiogroup"
          aria-label="Preview mode"
          className="shrink-0 flex items-center rounded overflow-hidden"
          style={{ border: '1px solid #FF6F00' }}
        >
          {(['proxy', 'cdp'] as const).map((m) => {
            const active = previewMode === m;
            return (
              <button
                key={m}
                role="radio"
                aria-checked={active}
                onClick={() => onModeChange(m)}
                title={m === 'proxy' ? 'Proxy preview (iframe)' : 'Browser preview (real Chrome — needed for cross-origin SSO)'}
                aria-label={m === 'proxy' ? 'Proxy preview mode' : 'Browser preview mode'}
                className="flex items-center gap-1 px-2 py-1 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                style={{
                  background: active ? '#FF6F00' : 'transparent',
                  color: active ? 'var(--vscode-titleBar-activeBackground, #3c3c3c)' : '#FF6F00',
                }}
              >
                {m === 'proxy' ? (
                  /* Bootstrap Icon: window */
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M2.5 4a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zm2-.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0zm1 .5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z"/>
                    <path d="M2 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2H2zm13 2v2H1V3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1zM1 6h14v7a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6z"/>
                  </svg>
                ) : (
                  /* Bootstrap Icon: globe */
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm7.5-6.923c-.67.204-1.335.82-1.887 1.855A7.97 7.97 0 0 0 5.145 4H7.5V1.077zM4.09 4a9.267 9.267 0 0 1 .64-1.539 6.7 6.7 0 0 1 .597-.933A7.025 7.025 0 0 0 2.255 4H4.09zm-.582 3.5c.03-.877.138-1.718.312-2.5H1.674a6.958 6.958 0 0 0-.656 2.5h2.49zM4.847 5a12.5 12.5 0 0 0-.338 2.5H7.5V5H4.847zM8.5 5v2.5h2.99a12.495 12.495 0 0 0-.337-2.5H8.5zM4.51 8.5a12.5 12.5 0 0 0 .337 2.5H7.5V8.5H4.51zm3.99 0V11h2.653c.187-.765.306-1.608.338-2.5H8.5zM5.145 12c.138.386.295.744.468 1.068.552 1.035 1.218 1.65 1.887 1.855V12H5.145zm.182 2.472a6.696 6.696 0 0 1-.597-.933A9.268 9.268 0 0 1 4.09 12H2.255a7.024 7.024 0 0 0 3.072 2.472zM3.82 11a13.652 13.652 0 0 1-.312-2.5h-2.49c.062.89.291 1.733.656 2.5H3.82zm6.853 3.472A7.024 7.024 0 0 0 13.745 12H11.91a9.27 9.27 0 0 1-.64 1.539 6.688 6.688 0 0 1-.597.933zM8.5 12v2.923c.67-.204 1.335-.82 1.887-1.855.173-.324.33-.682.468-1.068H8.5zm3.68-1h2.146c.365-.767.594-1.61.656-2.5h-2.49a13.65 13.65 0 0 1-.312 2.5zm2.802-3.5a6.959 6.959 0 0 0-.656-2.5H12.18c.174.782.282 1.623.312 2.5h2.49zM11.27 2.461c.247.464.462.98.64 1.539h1.835a7.024 7.024 0 0 0-3.072-2.472c.218.284.418.598.597.933zM10.855 4a7.966 7.966 0 0 0-.468-1.068C9.835 1.897 9.17 1.281 8.5 1.077V4h2.355z"/>
                  </svg>
                )}
                <span className="hidden sm:inline">{m === 'proxy' ? 'Proxy' : 'Browser'}</span>
              </button>
            );
          })}
        </div>

        {/* Pin visibility toggle */}
        <button
          onClick={onTogglePins}
          aria-pressed={pinsVisible}
          aria-label={pinsVisible ? 'Hide comment pins' : 'Show comment pins'}
          title={pinsVisible ? 'Hide comment pins on the preview (V)' : 'Show comment pins on the preview (V)'}
          className="shrink-0 flex items-center px-1.5 py-1 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          style={{
            color: pinsVisible ? '#FF6F00' : 'var(--vscode-titleBar-activeForeground, #ccc)',
            opacity: pinsVisible ? 1 : 0.5,
          }}
        >
          {pinsVisible ? (
            /* Bootstrap Icon: eye-fill */
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/>
              <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>
            </svg>
          ) : (
            /* Bootstrap Icon: eye-slash-fill */
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
              <path d="m10.79 12.912-1.614-1.615a3.5 3.5 0 0 1-4.474-4.474l-2.06-2.06C.938 6.278 0 8 0 8s3 5.5 8 5.5a7.029 7.029 0 0 0 2.79-.588zM5.21 3.088A7.028 7.028 0 0 1 8 2.5c5 0 8 5.5 8 5.5s-.939 1.721-2.641 3.238l-2.062-2.062a3.5 3.5 0 0 0-4.474-4.474L5.21 3.088z"/>
              <path d="M5.525 7.646a2.5 2.5 0 0 0 2.829 2.829l-2.83-2.829zm4.95.708-2.829-2.83a2.5 2.5 0 0 1 2.829 2.829zm3.171 6-12-12 .708-.708 12 12-.708.708z"/>
            </svg>
          )}
        </button>

        {/* Sidebar toggle */}
        <button
          onClick={onToggleSidebar}
          aria-pressed={sidebarOpen}
          aria-label={sidebarOpen ? 'Hide comments sidebar' : 'Show comments sidebar'}
          title={sidebarOpen ? 'Hide the comments sidebar (S)' : 'Show the comments sidebar (S)'}
          className="shrink-0 flex items-center px-1.5 py-1 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          style={{
            color: sidebarOpen ? '#FF6F00' : 'var(--vscode-titleBar-activeForeground, #ccc)',
            opacity: sidebarOpen ? 1 : 0.5,
          }}
        >
          {/* Bootstrap Icon: layout-text-sidebar-reverse */}
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h11A1.5 1.5 0 0 1 15 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 13.5v-11zm8.5-.5v12h3.5a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5H10zm-1 0H2.5a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5H9v-12zm-6 7h4a.5.5 0 0 1 0 1H3a.5.5 0 0 1 0-1zm0-3h4a.5.5 0 0 1 0 1H3a.5.5 0 0 1 0-1z"/>
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
