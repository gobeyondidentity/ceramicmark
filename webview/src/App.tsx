import React, { useEffect, useReducer, useRef, useState } from 'react';
import logoSvg from './ceramicmark_logo.svg?raw';
import { vscodeApi } from './vscode.js';
import { Toolbar } from './Toolbar.js';
import { PreviewFrame } from './PreviewFrame.js';
import { CommentSidebar } from './CommentSidebar.js';
import type { Author, Comment, ElementAnchor, ExtensionMessage, Member } from './types.js';

interface State {
  displayUrl: string;
  iframeUrl: string;
  comments: Comment[];
  identity: Author | null;
  members: Member[];
  commentMode: boolean;
  pendingAnchor: Partial<ElementAnchor> | null;
  focusedCommentId: string | null;
  focusCommentTs: number;
  currentPage: string;
  currentTitle: string;
  iframeReadyAt: number;
  unreadIds: Set<string>;
  currentBranch: string | null;
  sidebarOpen: boolean;
  connectionFailed: boolean;
}

type Action =
  | { type: 'SET_URL'; url: string }
  | { type: 'SET_PROXY_URL'; iframeUrl: string }
  | { type: 'SET_IDENTITY'; author: Author }
  | { type: 'LOAD_COMMENTS'; comments: Comment[] }
  | { type: 'ADD_COMMENT'; comment: Comment; identityEmail: string | null }
  | { type: 'UPDATE_COMMENT'; comment: Comment; identityEmail: string | null }
  | { type: 'DELETE_COMMENT'; commentId: string }
  | { type: 'TOGGLE_COMMENT_MODE' }
  | { type: 'ELEMENT_SELECTED'; anchor: Partial<ElementAnchor> }
  | { type: 'CANCEL_PENDING' }
  | { type: 'FOCUS_COMMENT'; commentId: string }
  | { type: 'LOAD_MEMBERS'; members: Member[] }
  | { type: 'MARK_READ'; commentId: string }
  | { type: 'SET_BRANCH'; branch: string }
  | { type: 'IFRAME_NAVIGATED'; pathname: string; title?: string }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_SIDEBAR'; open: boolean }
  | { type: 'CONNECTION_FAILED' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_URL':
      return { ...state, displayUrl: action.url, iframeUrl: '', connectionFailed: false };
    case 'SET_PROXY_URL':
      return { ...state, iframeUrl: action.iframeUrl, connectionFailed: false };
    case 'SET_IDENTITY':
      return { ...state, identity: action.author };
    case 'LOAD_COMMENTS':
      return { ...state, comments: action.comments };
    case 'ADD_COMMENT': {
      const unreadIds = new Set(state.unreadIds);
      if (action.identityEmail && action.comment.author.email !== action.identityEmail) {
        unreadIds.add(action.comment.id);
      }
      return {
        ...state,
        comments: [...state.comments, action.comment],
        commentMode: false,
        pendingAnchor: null,
        unreadIds,
      };
    }
    case 'UPDATE_COMMENT': {
      const unreadIds = new Set(state.unreadIds);
      const lastReply = action.comment.replies.at(-1);
      if (lastReply && action.identityEmail && lastReply.author.email !== action.identityEmail) {
        unreadIds.add(action.comment.id);
      }
      return {
        ...state,
        comments: state.comments.map((c) => (c.id === action.comment.id ? action.comment : c)),
        unreadIds,
      };
    }
    case 'DELETE_COMMENT':
      return { ...state, comments: state.comments.filter((c) => c.id !== action.commentId) };
    case 'TOGGLE_COMMENT_MODE':
      return { ...state, commentMode: !state.commentMode, pendingAnchor: null };
    case 'ELEMENT_SELECTED':
      return { ...state, pendingAnchor: action.anchor };
    case 'CANCEL_PENDING':
      return { ...state, pendingAnchor: null };
    case 'FOCUS_COMMENT':
      return { ...state, focusedCommentId: action.commentId, focusCommentTs: Date.now() };
    case 'LOAD_MEMBERS':
      return { ...state, members: action.members };
    case 'MARK_READ': {
      const unreadIds = new Set(state.unreadIds);
      unreadIds.delete(action.commentId);
      return { ...state, unreadIds };
    }
    case 'SET_BRANCH':
      return { ...state, currentBranch: action.branch };
    case 'IFRAME_NAVIGATED':
      return { ...state, currentPage: action.pathname, currentTitle: action.title ?? state.currentTitle, iframeReadyAt: Date.now(), connectionFailed: false };
    case 'CONNECTION_FAILED':
      return { ...state, connectionFailed: true };
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen };
    case 'SET_SIDEBAR':
      return { ...state, sidebarOpen: action.open };
    default:
      return state;
  }
}

const initialState: State = {
  displayUrl: '',
  iframeUrl: '',
  comments: [],
  identity: null,
  members: [],
  commentMode: false,
  pendingAnchor: null,
  focusedCommentId: null,
  focusCommentTs: 0,
  currentPage: '/',
  currentTitle: '',
  iframeReadyAt: 0,
  unreadIds: new Set(),
  currentBranch: null,
  sidebarOpen: true,
  connectionFailed: false,
};

export function App(): React.ReactElement {
  const [state, dispatch] = useReducer(reducer, initialState);
  const isMounted = useRef(false);
  const identityRef = useRef<string | null>(null);
  const hasUrlRef = useRef(false);
  useEffect(() => { hasUrlRef.current = !!state.displayUrl; }, [state.displayUrl]);

  useEffect(() => {
    if (isMounted.current) return;
    isMounted.current = true;

    vscodeApi.postMessage({ type: 'ready' });

    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (!message || typeof message.type !== 'string') return;

      // Messages from the iframe companion script
      if (message.type === 'cm-connection-failed') {
        dispatch({ type: 'CONNECTION_FAILED' });
        return;
      }

      if (message.type === 'cm-element-selected') {
        dispatch({
          type: 'ELEMENT_SELECTED',
          anchor: {
            pageUrl: message.pathname,
            pageTitle: message.title || undefined,
            label: message.label,
            tag: message.tag,
            elementId: message.elementId || undefined,
            testId: message.testId || undefined,
            text: message.text || undefined,
            cssPath: message.cssPath || undefined,
          },
        });
        return;
      }
      if (message.type === 'cm-marker-clicked') {
        dispatch({ type: 'FOCUS_COMMENT', commentId: message.commentId });
        return;
      }
      if (message.type === 'cm-navigate') {
        try {
          const parsed = new URL(message.pathname, 'http://x');
          const page = parsed.pathname + parsed.search + parsed.hash;
          dispatch({ type: 'IFRAME_NAVIGATED', pathname: page, title: message.title });
        } catch {
          dispatch({ type: 'IFRAME_NAVIGATED', pathname: message.pathname, title: message.title });
        }
        return;
      }

      // Messages from the extension host
      const extMsg = message as ExtensionMessage;
      switch (extMsg.type) {
        case 'identity':
          identityRef.current = extMsg.author.email;
          dispatch({ type: 'SET_IDENTITY', author: extMsg.author });
          break;
        case 'loadComments':
          dispatch({ type: 'LOAD_COMMENTS', comments: extMsg.comments });
          break;
        case 'commentAdded':
          dispatch({ type: 'ADD_COMMENT', comment: extMsg.comment, identityEmail: identityRef.current });
          break;
        case 'commentUpdated':
          dispatch({ type: 'UPDATE_COMMENT', comment: extMsg.comment, identityEmail: identityRef.current });
          break;
        case 'commentDeleted':
          dispatch({ type: 'DELETE_COMMENT', commentId: extMsg.commentId });
          break;
        case 'focusComment':
          dispatch({ type: 'FOCUS_COMMENT', commentId: extMsg.commentId });
          break;
        case 'setBranch':
          dispatch({ type: 'SET_BRANCH', branch: extMsg.branch });
          break;
        case 'loadMembers':
          dispatch({ type: 'LOAD_MEMBERS', members: extMsg.members });
          break;
        case 'proxyReady':
          dispatch({ type: 'SET_PROXY_URL', iframeUrl: extMsg.proxyUrl });
          break;
        case 'toggleCommentMode':
          dispatch({ type: 'TOGGLE_COMMENT_MODE' });
          break;
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Auto-collapse sidebar when panel is narrow (< 640px)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    if (mq.matches) dispatch({ type: 'SET_SIDEBAR', open: false });
    const handler = (e: MediaQueryListEvent) =>
      dispatch({ type: 'SET_SIDEBAR', open: !e.matches });
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // 'C' key toggles comment mode (Figma-style), skips when focus is in an input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!hasUrlRef.current) return;
      if (e.key !== 'c' && e.key !== 'C') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      dispatch({ type: 'TOGGLE_COMMENT_MODE' });
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleUrlChange = (url: string) => {
    dispatch({ type: 'SET_URL', url });
    vscodeApi.postMessage({ type: 'setTargetUrl', url });
  };

  const memberNames = state.members.map((m) => m.name);
  const focusedComment = state.focusedCommentId
    ? (state.comments.find((c) => c.id === state.focusedCommentId) ?? null)
    : null;

  if (!state.displayUrl) {
    return <SplashScreen onUrlChange={handleUrlChange} />;
  }

  return (
    <div className="flex flex-row h-screen overflow-hidden">
      {/* Left: toolbar + preview iframe */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Toolbar
          previewUrl={state.displayUrl}
          commentMode={state.commentMode}
          currentBranch={state.currentBranch}
          sidebarOpen={state.sidebarOpen}
          onUrlChange={handleUrlChange}
          onToggleCommentMode={() => dispatch({ type: 'TOGGLE_COMMENT_MODE' })}
          onToggleSidebar={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
        />
        <PreviewFrame
          iframeUrl={state.iframeUrl}
          displayUrl={state.displayUrl}
          commentMode={state.commentMode}
          focusedComment={focusedComment}
          focusCommentTs={state.focusCommentTs}
          currentPage={state.currentPage}
          currentTitle={state.currentTitle}
          iframeReadyAt={state.iframeReadyAt}
          comments={state.comments}
          connectionFailed={state.connectionFailed}
          onCommentModeExit={() => dispatch({ type: 'TOGGLE_COMMENT_MODE' })}
          onRetryUrl={() => document.getElementById('toolbar-url-input')?.focus()}
        />
      </div>

      {/* Right: comments sidebar — hidden when collapsed */}
      {state.sidebarOpen && (
        <CommentSidebar
          comments={state.comments}
          pendingAnchor={state.pendingAnchor}
          memberNames={memberNames}
          currentBranch={state.currentBranch}
          currentPage={state.currentPage}
          focusedCommentId={state.focusedCommentId}
          unreadIds={state.unreadIds}
          onCancelPending={() => dispatch({ type: 'CANCEL_PENDING' })}
          onFocusComment={(id) => dispatch({ type: 'FOCUS_COMMENT', commentId: id })}
          onMarkRead={(id) => dispatch({ type: 'MARK_READ', commentId: id })}
        />
      )}
    </div>
  );
}

function SplashScreen({ onUrlChange }: { onUrlChange: (url: string) => void }): React.ReactElement {
  const [inputValue, setInputValue] = useState('');
  const bgUri = document.querySelector<HTMLMetaElement>('meta[name="cm-bg"]')?.content;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const url = inputValue.trim();
    if (url) {
      onUrlChange(url.startsWith('http') ? url : `http://${url}`);
    }
  };

  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-6 h-screen"
      style={bgUri ? { backgroundImage: `url(${bgUri})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
    >
      <div
        style={{ width: '282px', filter: 'brightness(0) invert(1)' }}
        dangerouslySetInnerHTML={{ __html: logoSvg.replace(/<svg /, '<svg width="282" ') }}
      />
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-1 w-80 rounded"
        aria-label="Enter development server URL"
        style={{
          background: 'rgba(255,255,255,0.08)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.2)',
          padding: '2px 4px',
        }}
      >
        <label htmlFor="splash-url-input" className="sr-only">Development server URL</label>
        <input
          id="splash-url-input"
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={() => { if (!inputValue) setInputValue('http://localhost:'); }}
          placeholder="Enter Dev Server: ex http://localhost:3000 | Press Enter"
          autoFocus
          className="flex-1 px-2 py-1 text-xs min-w-0 outline-none placeholder-white"
          style={{
            background: 'transparent',
            color: '#fff',
            border: 'none',
          }}
        />
      </form>
      <p className="text-xs text-center w-80" style={{ color: 'rgba(255,255,255,0.6)' }}>
        An extension that lets product builders leave visual comments directly on a live localhost preview — Run a dev server, enter your localhost, Collaborate.
      </p>
    </div>
  );
}
