import React, { useEffect, useReducer, useRef, useState } from 'react';
import logoSvg from './ceramicmark_logo.svg?raw';
import { vscodeApi } from './vscode.js';
import { Toolbar } from './Toolbar.js';
import { PreviewFrame } from './PreviewFrame.js';
import type { Author, Comment, ExtensionMessage, Member } from './types.js';

interface State {
  previewUrl: string;
  comments: Comment[];
  identity: Author | null;
  members: Member[];
  commentMode: boolean;
  pinsVisible: boolean;
  focusedPinId: string | null;
  unreadIds: Set<string>;
  currentBranch: string | null;
}

type Action =
  | { type: 'SET_URL'; url: string }
  | { type: 'SET_IDENTITY'; author: Author }
  | { type: 'LOAD_COMMENTS'; comments: Comment[] }
  | { type: 'ADD_COMMENT'; comment: Comment; identityEmail: string | null }
  | { type: 'UPDATE_COMMENT'; comment: Comment; identityEmail: string | null }
  | { type: 'DELETE_COMMENT'; commentId: string }
  | { type: 'TOGGLE_COMMENT_MODE' }
  | { type: 'TOGGLE_PINS_VISIBLE' }
  | { type: 'FOCUS_PIN'; commentId: string }
  | { type: 'LOAD_MEMBERS'; members: Member[] }
  | { type: 'MARK_READ'; commentId: string }
  | { type: 'SET_BRANCH'; branch: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_URL':
      return { ...state, previewUrl: action.url };
    case 'SET_IDENTITY':
      return { ...state, identity: action.author };
    case 'LOAD_COMMENTS':
      return { ...state, comments: action.comments };
    case 'ADD_COMMENT': {
      const unreadIds = new Set(state.unreadIds);
      if (action.identityEmail && action.comment.author.email !== action.identityEmail) {
        unreadIds.add(action.comment.id);
      }
      return { ...state, comments: [...state.comments, action.comment], commentMode: false, unreadIds };
    }
    case 'UPDATE_COMMENT': {
      const unreadIds = new Set(state.unreadIds);
      const lastReply = action.comment.replies.at(-1);
      if (lastReply && action.identityEmail && lastReply.author.email !== action.identityEmail) {
        unreadIds.add(action.comment.id);
      }
      return {
        ...state,
        comments: state.comments.map((c) => c.id === action.comment.id ? action.comment : c),
        unreadIds,
      };
    }
    case 'DELETE_COMMENT':
      return { ...state, comments: state.comments.filter((c) => c.id !== action.commentId) };
    case 'TOGGLE_COMMENT_MODE':
      return { ...state, commentMode: !state.commentMode };
    case 'TOGGLE_PINS_VISIBLE':
      return { ...state, pinsVisible: !state.pinsVisible };
    case 'FOCUS_PIN':
      return { ...state, focusedPinId: action.commentId, pinsVisible: true };
    case 'LOAD_MEMBERS':
      return { ...state, members: action.members };
    case 'MARK_READ': {
      const unreadIds = new Set(state.unreadIds);
      unreadIds.delete(action.commentId);
      return { ...state, unreadIds };
    }
    case 'SET_BRANCH':
      return { ...state, currentBranch: action.branch };
    default:
      return state;
  }
}

const initialState: State = {
  previewUrl: '',
  comments: [],
  identity: null,
  members: [],
  commentMode: false,
  pinsVisible: true,
  focusedPinId: null,
  unreadIds: new Set(),
  currentBranch: null,
};

export function App(): React.ReactElement {
  const [state, dispatch] = useReducer(reducer, initialState);
  const isMounted = useRef(false);
  const identityRef = useRef<string | null>(null);

  useEffect(() => {
    if (isMounted.current) return;
    isMounted.current = true;

    vscodeApi.postMessage({ type: 'ready' });

    const handler = (event: MessageEvent) => {
      const message = event.data as ExtensionMessage;
      switch (message.type) {
        case 'identity':
          identityRef.current = message.author.email;
          dispatch({ type: 'SET_IDENTITY', author: message.author });
          break;
        case 'loadComments':
          dispatch({ type: 'LOAD_COMMENTS', comments: message.comments });
          break;
        case 'commentAdded':
          dispatch({ type: 'ADD_COMMENT', comment: message.comment, identityEmail: identityRef.current });
          break;
        case 'commentUpdated':
          dispatch({ type: 'UPDATE_COMMENT', comment: message.comment, identityEmail: identityRef.current });
          break;
        case 'commentDeleted':
          dispatch({ type: 'DELETE_COMMENT', commentId: message.commentId });
          break;
        case 'focusPin':
          dispatch({ type: 'FOCUS_PIN', commentId: message.commentId });
          break;
        case 'setBranch':
          dispatch({ type: 'SET_BRANCH', branch: message.branch });
          break;
        case 'loadMembers':
          dispatch({ type: 'LOAD_MEMBERS', members: message.members });
          break;
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const memberNames = state.members.map((m) => m.name);

  if (!state.previewUrl) {
    return <SplashScreen onUrlChange={(url) => dispatch({ type: 'SET_URL', url })} />;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Toolbar
        previewUrl={state.previewUrl}
        commentMode={state.commentMode}
        pinsVisible={state.pinsVisible}
        currentBranch={state.currentBranch}
        onUrlChange={(url) => dispatch({ type: 'SET_URL', url })}
        onToggleCommentMode={() => dispatch({ type: 'TOGGLE_COMMENT_MODE' })}
        onTogglePinsVisible={() => dispatch({ type: 'TOGGLE_PINS_VISIBLE' })}
      />
      <PreviewFrame
        url={state.previewUrl}
        comments={state.comments}
        commentMode={state.commentMode}
        pinsVisible={state.pinsVisible}
        focusedPinId={state.focusedPinId}
        memberNames={memberNames}
        unreadIds={state.unreadIds}
        currentBranch={state.currentBranch}
        onCommentModeExit={() => dispatch({ type: 'TOGGLE_COMMENT_MODE' })}
        onClearFocus={() => dispatch({ type: 'FOCUS_PIN', commentId: '' })}
        onMarkRead={(commentId) => dispatch({ type: 'MARK_READ', commentId })}
      />
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
        dangerouslySetInnerHTML={{ __html: logoSvg.replace(/<svg /, '<svg width="282" height="auto" ') }}
      />
      <form onSubmit={handleSubmit} className="flex items-center gap-1 w-80">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={() => { if (!inputValue) setInputValue('http://localhost:'); }}
          placeholder="Enter Dev Server: ex http://localhost:3000 | Press Enter"
          autoFocus
          className="flex-1 px-2 py-1 text-xs rounded min-w-0 outline-none placeholder-white"
          style={{
            background: 'transparent',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.6)',
          }}
        />
      </form>
      <p className="text-xs text-center w-80" style={{ color: 'rgba(255,255,255,0.6)' }}>
        An extension that lets product builders leave visual, pin-based comments directly on a live localhost preview — Run a dev server, enter your localhost, Collaborate.
      </p>
    </div>
  );
}
