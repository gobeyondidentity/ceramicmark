import React, { useEffect, useReducer, useRef } from 'react';
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
}

type Action =
  | { type: 'SET_URL'; url: string }
  | { type: 'SET_IDENTITY'; author: Author }
  | { type: 'LOAD_COMMENTS'; comments: Comment[] }
  | { type: 'ADD_COMMENT'; comment: Comment }
  | { type: 'UPDATE_COMMENT'; comment: Comment }
  | { type: 'DELETE_COMMENT'; commentId: string }
  | { type: 'TOGGLE_COMMENT_MODE' }
  | { type: 'TOGGLE_PINS_VISIBLE' }
  | { type: 'FOCUS_PIN'; commentId: string }
  | { type: 'LOAD_MEMBERS'; members: Member[] };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_URL':
      return { ...state, previewUrl: action.url };
    case 'SET_IDENTITY':
      return { ...state, identity: action.author };
    case 'LOAD_COMMENTS':
      return { ...state, comments: action.comments };
    case 'ADD_COMMENT':
      return { ...state, comments: [...state.comments, action.comment], commentMode: false };
    case 'UPDATE_COMMENT':
      return {
        ...state,
        comments: state.comments.map((c) => c.id === action.comment.id ? action.comment : c),
      };
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
};

export function App(): React.ReactElement {
  const [state, dispatch] = useReducer(reducer, initialState);
  const isMounted = useRef(false);

  useEffect(() => {
    if (isMounted.current) return;
    isMounted.current = true;

    vscodeApi.postMessage({ type: 'ready' });

    const handler = (event: MessageEvent) => {
      const message = event.data as ExtensionMessage;
      switch (message.type) {
        case 'identity':
          dispatch({ type: 'SET_IDENTITY', author: message.author });
          break;
        case 'loadComments':
          dispatch({ type: 'LOAD_COMMENTS', comments: message.comments });
          break;
        case 'commentAdded':
          dispatch({ type: 'ADD_COMMENT', comment: message.comment });
          break;
        case 'commentUpdated':
          dispatch({ type: 'UPDATE_COMMENT', comment: message.comment });
          break;
        case 'commentDeleted':
          dispatch({ type: 'DELETE_COMMENT', commentId: message.commentId });
          break;
        case 'focusPin':
          dispatch({ type: 'FOCUS_PIN', commentId: message.commentId });
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

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Toolbar
        previewUrl={state.previewUrl}
        commentMode={state.commentMode}
        pinsVisible={state.pinsVisible}
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
        onCommentModeExit={() => dispatch({ type: 'TOGGLE_COMMENT_MODE' })}
        onClearFocus={() => dispatch({ type: 'FOCUS_PIN', commentId: '' })}
      />
    </div>
  );
}
