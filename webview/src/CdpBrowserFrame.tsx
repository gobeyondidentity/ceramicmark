import React, { useEffect, useRef, useState } from 'react';
import { vscodeApi } from './vscode.js';
import { CommentThread } from './CommentThread.js';
import { CommentForm } from './CommentForm.js';
import type { ChromeStatus, CdpInputEvent, Comment, ElementAnchor, CmHostToPage } from './types.js';

interface CdpBrowserFrameProps {
  chromeStatus: ChromeStatus | 'notfound' | null;
  commentMode: boolean;
  comments: Comment[];
  pinsVisible: boolean;
  memberNames: string[];
  currentPage: string;
  pendingAnchor: Partial<ElementAnchor> | null;
  pendingPosition: { x: number; y: number } | null;
  focusedComment: Comment | null;
  focusedOrphaned?: boolean;
  focusedPinPosition: { x: number; y: number } | null;
  focusCommentTs: number;
  onPickBrowser: () => void;
  onSwitchToProxy: () => void;
  onCancelPending: () => void;
  onClearFocus: () => void;
  onCommentModeExit: () => void;
}

const BUTTONS: Record<number, 'left' | 'middle' | 'right'> = { 0: 'left', 1: 'middle', 2: 'right' };

/**
 * Browser-mode surface: live screencast of the real Chrome page + input forwarding, with the
 * companion injected into the page over CDP. Host→page cm-* messages go out as cmToPage; the
 * comment popovers render over the canvas, positioned via the letterbox geometry.
 */
export function CdpBrowserFrame(props: CdpBrowserFrameProps): React.ReactElement {
  const {
    chromeStatus, commentMode, comments, pinsVisible, memberNames, currentPage,
    pendingAnchor, pendingPosition, focusedComment, focusedOrphaned, focusedPinPosition, focusCommentTs,
    onPickBrowser, onSwitchToProxy, onCancelPending, onClearFocus, onCommentModeExit,
  } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const geomRef = useRef({ dx: 0, dy: 0, scale: 1, dpr: 1 });
  const lastSentRef = useRef({ w: 0, h: 0 });
  const [hasFrame, setHasFrame] = useState(false);
  const hasFrameRef = useRef(false);
  const status = chromeStatus ?? 'launching';

  // Tell the host the panel's current CSS size so the rendered viewport matches it exactly.
  const reportViewport = () => {
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const w = Math.round(r.width), h = Math.round(r.height);
    lastSentRef.current = { w, h };
    vscodeApi.postMessage({ type: 'resizeViewport', cssWidth: w, cssHeight: h, dpr: window.devicePixelRatio || 1 });
  };
  const showCanvas = status === 'connected' || status === 'login' || status === 'authenticated' || status === 'launching';

  const sendToPage = (payload: CmHostToPage) => vscodeApi.postMessage({ type: 'cmToPage', payload });
  const sendHighlight = (c: Comment) => sendToPage({
    type: 'cm-highlight-element', elementId: c.anchor?.elementId, testId: c.anchor?.testId,
    tag: c.anchor?.tag, text: c.anchor?.text, cssPath: c.anchor?.cssPath,
  });

  // Host → page: comment-mode cursor.
  useEffect(() => {
    sendToPage({ type: 'cm-comment-mode', active: commentMode });
  }, [commentMode]);

  // Host → page: (re)render comment markers. Re-sent on page change so a fresh document re-anchors.
  useEffect(() => {
    const markerData = pinsVisible
      ? comments.map((c) => ({
          id: c.id, elementId: c.anchor?.elementId, testId: c.anchor?.testId,
          tag: c.anchor?.tag, text: c.anchor?.text, cssPath: c.anchor?.cssPath, status: c.status,
        }))
      : [];
    sendToPage({ type: 'cm-update-markers', comments: markerData });
  }, [comments, pinsVisible, currentPage]);

  // Focus a comment: if it lives on another page, navigate the browser there first (the
  // highlight is re-applied once that page loads — see the currentPage effect below);
  // otherwise highlight it now.
  useEffect(() => {
    if (!focusedComment) { sendToPage({ type: 'cm-clear-highlight' }); return; }
    const page = focusedComment.anchor?.pageUrl ?? '/';
    if (page !== currentPage) {
      vscodeApi.postMessage({ type: 'navigateBrowser', path: page });
    } else {
      sendHighlight(focusedComment);
    }
  }, [focusCommentTs]);

  // After the page changes (incl. navigating to a focused comment's page), re-apply the
  // highlight — the companion on the freshly loaded page needs it re-sent.
  useEffect(() => {
    if (focusedComment) sendHighlight(focusedComment);
  }, [currentPage]);

  // Exit comment mode on Escape.
  useEffect(() => {
    if (!commentMode) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCommentModeExit(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [commentMode, onCommentModeExit]);

  // Report panel size so the host matches the rendered viewport (and restarts the screencast).
  useEffect(() => {
    if (!showCanvas) return;
    const el = containerRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ro = new ResizeObserver(() => { clearTimeout(timer); timer = setTimeout(reportViewport, 120); });
    ro.observe(el);
    reportViewport();
    return () => { clearTimeout(timer); ro.disconnect(); };
  }, [showCanvas]);

  // Draw incoming screencast frames letterboxed into a backing store sized to the panel.
  useEffect(() => {
    if (!showCanvas) return;
    let latest: string | null = null;
    let scheduled = false;
    const paint = () => {
      scheduled = false;
      const uri = latest;
      const c = canvasRef.current;
      if (!uri || !c) return;
      const img = new Image();
      img.onload = () => {
        const dpr = window.devicePixelRatio || 1;
        const bw = Math.max(1, Math.round(c.clientWidth * dpr));
        const bh = Math.max(1, Math.round(c.clientHeight * dpr));
        if (c.width !== bw) c.width = bw;
        if (c.height !== bh) c.height = bh;
        const ctx = c.getContext('2d');
        if (!ctx) return;
        const scale = Math.min(bw / img.width, bh / img.height);
        const dw = img.width * scale, dh = img.height * scale;
        const dx = (bw - dw) / 2, dy = (bh - dh) / 2;
        geomRef.current = { dx, dy, scale, dpr };
        ctx.clearRect(0, 0, bw, bh);
        ctx.drawImage(img, dx, dy, dw, dh);
        if (!hasFrameRef.current) { hasFrameRef.current = true; setHasFrame(true); }
        // Self-heal: if the panel size drifted from what the host is rendering (causing
        // letterbox bars), re-sync the viewport so the frame fills the panel exactly.
        if (Math.abs(c.clientWidth - lastSentRef.current.w) > 2 || Math.abs(c.clientHeight - lastSentRef.current.h) > 2) {
          reportViewport();
        }
      };
      img.src = uri;
    };
    const onMessage = (e: MessageEvent) => {
      const d = e.data;
      if (!d || d.type !== 'screencastFrame') return;
      latest = d.dataUri;
      if (!scheduled) { scheduled = true; requestAnimationFrame(paint); }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [showCanvas]);

  // Map a DOM event to page-viewport CSS coordinates, undoing the letterbox + DPR scaling.
  const toViewport = (e: { clientX: number; clientY: number }): { x: number; y: number } => {
    const c = canvasRef.current;
    const r = c?.getBoundingClientRect();
    if (!c || !r || r.width === 0 || r.height === 0) return { x: 0, y: 0 };
    const { dx, dy, scale, dpr } = geomRef.current;
    const deviceX = (e.clientX - r.left) * (c.width / r.width);
    const deviceY = (e.clientY - r.top) * (c.height / r.height);
    return { x: Math.round((deviceX - dx) / scale / dpr), y: Math.round((deviceY - dy) / scale / dpr) };
  };
  // Inverse: page-viewport CSS coords → container-relative CSS coords (for placing popovers).
  const toContainer = (p: { x: number; y: number }): { x: number; y: number } => {
    const { dx, dy, scale, dpr } = geomRef.current;
    return { x: dx / dpr + p.x * scale, y: dy / dpr + p.y * scale };
  };
  const sendInput = (event: CdpInputEvent) => vscodeApi.postMessage({ type: 'inputEvent', event });

  const onMouseMove = (e: React.MouseEvent) => { const { x, y } = toViewport(e); sendInput({ kind: 'mouse', eventType: 'mouseMoved', x, y, buttons: e.buttons }); };
  const onMouseDown = (e: React.MouseEvent) => { canvasRef.current?.focus(); const { x, y } = toViewport(e); sendInput({ kind: 'mouse', eventType: 'mousePressed', x, y, button: BUTTONS[e.button] ?? 'left', clickCount: 1, buttons: e.buttons }); };
  const onMouseUp = (e: React.MouseEvent) => { const { x, y } = toViewport(e); sendInput({ kind: 'mouse', eventType: 'mouseReleased', x, y, button: BUTTONS[e.button] ?? 'left', clickCount: 1, buttons: e.buttons }); };
  const onWheel = (e: React.WheelEvent) => { const { x, y } = toViewport(e); sendInput({ kind: 'wheel', x, y, deltaX: e.deltaX, deltaY: e.deltaY }); };
  const onKeyDown = (e: React.KeyboardEvent) => { e.preventDefault(); const printable = e.key.length === 1; sendInput({ kind: 'key', eventType: 'keyDown', key: e.key, code: e.code, text: printable ? e.key : undefined, windowsVirtualKeyCode: (e as unknown as { keyCode: number }).keyCode }); };
  const onKeyUp = (e: React.KeyboardEvent) => { e.preventDefault(); sendInput({ kind: 'key', eventType: 'keyUp', key: e.key, code: e.code, windowsVirtualKeyCode: (e as unknown as { keyCode: number }).keyCode }); };

  // Edge-aware popover placement (mirrors PreviewFrame), in container CSS coords.
  const popoverStyle = (pagePos: { x: number; y: number } | null, w: number, h: number): React.CSSProperties => {
    const cw = containerRef.current?.offsetWidth ?? 600;
    const ch = containerRef.current?.offsetHeight ?? 400;
    const base: React.CSSProperties = { position: 'absolute', zIndex: 20, width: `${w}px` };
    if (!pagePos) return { ...base, top: 16, right: 16 };
    const pos = toContainer(pagePos);
    const flipX = pos.x + w + 16 > cw;
    const flipY = pos.y + h + 8 > ch;
    return {
      ...base,
      left: flipX ? undefined : pos.x + 12,
      right: flipX ? cw - pos.x + 12 : undefined,
      top: flipY ? undefined : pos.y,
      bottom: flipY ? ch - pos.y : undefined,
    };
  };

  // --- Non-canvas states: Chrome missing or crashed ---
  if (status === 'notfound' || status === 'crashed') {
    const copy =
      status === 'notfound'
        ? { title: 'Chrome or Edge is required', sub: 'Browser mode needs a Chrome, Edge, or Chromium browser installed. Choose one, or switch back to Proxy mode.' }
        : { title: 'Browser closed', sub: 'The Chrome window was closed or crashed.' };
    return (
      <div className="relative flex-1 overflow-hidden flex items-center justify-center" style={{ background: '#42372B' }} role="status" aria-live="polite">
        <div className="text-center px-6 py-8" style={{ maxWidth: '380px' }}>
          <div className="text-sm mb-2" style={{ color: '#FF6F00', fontWeight: 600 }}>{copy.title}</div>
          <div className="text-xs mb-5" style={{ color: '#FF6F00', lineHeight: 1.6 }}>{copy.sub}</div>
          {status === 'notfound' && (
            <button onClick={onPickBrowser} className="text-xs px-3 py-1.5 rounded focus-visible:outline focus-visible:outline-2 mr-2"
              style={{ background: '#FF6F00', border: '1px solid #FF6F00', color: 'var(--vscode-titleBar-activeBackground, #3c3c3c)', cursor: 'pointer' }}
              aria-label="Choose a browser executable">Choose browser…</button>
          )}
          <button onClick={onSwitchToProxy} className="text-xs px-3 py-1.5 rounded focus-visible:outline focus-visible:outline-2"
            style={{ background: 'transparent', border: '1px solid #FF6F00', color: '#FF6F00', cursor: 'pointer' }}
            aria-label="Switch back to Proxy mode">Switch to Proxy mode</button>
        </div>
      </div>
    );
  }

  // --- Canvas states: launching / connected / login / authenticated ---
  return (
    <div ref={containerRef} className="relative flex-1 overflow-hidden" style={{ background: '#1e1e1e' }}>
      <canvas
        ref={canvasRef}
        tabIndex={0}
        aria-label="Live browser preview"
        className="w-full h-full block outline-none"
        style={{ cursor: commentMode ? 'crosshair' : 'default' }}
        onMouseMove={onMouseMove}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onContextMenu={(e) => e.preventDefault()}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
      />

      {/* Focused comment popover */}
      {focusedComment && (
        <div style={popoverStyle(focusedPinPosition, 296, 340)}>
          <CommentThread comment={focusedComment} memberNames={memberNames} orphaned={focusedOrphaned} onClose={onClearFocus} />
        </div>
      )}

      {/* New comment form popover */}
      {pendingAnchor && (
        <div style={popoverStyle(pendingPosition, 296, 260)}>
          <CommentForm anchor={pendingAnchor} memberNames={memberNames} onCancel={onCancelPending} />
        </div>
      )}

      {/* Loading state: shown immediately on entering Browser mode and until the first frame paints. */}
      {!hasFrame && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none" style={{ background: '#1e1e1e' }}>
          <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="#FF6F00" strokeOpacity="0.25" strokeWidth="3" />
            <path d="M22 12a10 10 0 0 0-10-10" stroke="#FF6F00" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <div className="text-xs" style={{ color: '#FF6F00' }}>
            {status === 'login' ? 'Opening sign-in…' : status === 'launching' ? 'Starting browser…' : 'Loading preview…'}
          </div>
        </div>
      )}
      {status === 'login' && (
        <div
          className="absolute top-0 left-0 right-0 text-xs px-3 py-2 text-center"
          style={{ background: '#FF6F00', color: 'var(--vscode-titleBar-activeBackground, #3c3c3c)' }}
          role="status"
          aria-live="polite"
        >
          Signing in — complete the login in the Chrome window. You’ll return here automatically.
        </div>
      )}
      {commentMode && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs px-3 py-1.5 rounded-full pointer-events-none"
          style={{ background: '#FF6F00', color: 'var(--vscode-titleBar-activeBackground, #3c3c3c)', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
          Click any element to comment · Esc to cancel
        </div>
      )}
    </div>
  );
}
