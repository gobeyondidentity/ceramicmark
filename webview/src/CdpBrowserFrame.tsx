import React, { useEffect, useRef } from 'react';
import { vscodeApi } from './vscode.js';
import type { ChromeStatus, CdpInputEvent } from './types.js';

interface CdpBrowserFrameProps {
  chromeStatus: ChromeStatus | 'notfound' | null;
  onPickBrowser: () => void;
  onSwitchToProxy: () => void;
}

const BUTTONS: Record<number, 'left' | 'middle' | 'right'> = { 0: 'left', 1: 'middle', 2: 'right' };

/**
 * Browser-mode surface: renders the real Chrome page as a live screencast in the VS Code panel
 * and forwards mouse/scroll/keyboard input back to the page over CDP. Frames are drawn letterboxed
 * (aspect-preserving) so the page is never distorted, even while a panel resize is settling.
 */
export function CdpBrowserFrame({
  chromeStatus,
  onPickBrowser,
  onSwitchToProxy,
}: CdpBrowserFrameProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Geometry of the last drawn frame within the canvas backing store, for input mapping.
  const geomRef = useRef({ dx: 0, dy: 0, scale: 1, dpr: 1 });
  const status = chromeStatus ?? 'launching';
  const showCanvas = status === 'connected' || status === 'login' || status === 'authenticated' || status === 'launching';

  // Report panel size so the host matches the rendered viewport (and restarts the screencast).
  useEffect(() => {
    if (!showCanvas) return;
    const el = containerRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const report = () => {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      vscodeApi.postMessage({
        type: 'resizeViewport',
        cssWidth: Math.round(r.width),
        cssHeight: Math.round(r.height),
        dpr: window.devicePixelRatio || 1,
      });
    };
    const ro = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(report, 150);
    });
    ro.observe(el);
    report();
    return () => {
      clearTimeout(timer);
      ro.disconnect();
    };
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
        const dw = img.width * scale;
        const dh = img.height * scale;
        const dx = (bw - dw) / 2;
        const dy = (bh - dh) / 2;
        geomRef.current = { dx, dy, scale, dpr };
        ctx.clearRect(0, 0, bw, bh);
        ctx.drawImage(img, dx, dy, dw, dh);
      };
      img.src = uri;
    };
    const onMessage = (e: MessageEvent) => {
      const d = e.data;
      if (!d || d.type !== 'screencastFrame') return;
      latest = d.dataUri;
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(paint);
      }
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
    return {
      x: Math.round((deviceX - dx) / scale / dpr),
      y: Math.round((deviceY - dy) / scale / dpr),
    };
  };
  const sendInput = (event: CdpInputEvent) => vscodeApi.postMessage({ type: 'inputEvent', event });

  const onMouseMove = (e: React.MouseEvent) => {
    const { x, y } = toViewport(e);
    sendInput({ kind: 'mouse', eventType: 'mouseMoved', x, y, buttons: e.buttons });
  };
  const onMouseDown = (e: React.MouseEvent) => {
    canvasRef.current?.focus();
    const { x, y } = toViewport(e);
    sendInput({ kind: 'mouse', eventType: 'mousePressed', x, y, button: BUTTONS[e.button] ?? 'left', clickCount: 1, buttons: e.buttons });
  };
  const onMouseUp = (e: React.MouseEvent) => {
    const { x, y } = toViewport(e);
    sendInput({ kind: 'mouse', eventType: 'mouseReleased', x, y, button: BUTTONS[e.button] ?? 'left', clickCount: 1, buttons: e.buttons });
  };
  const onWheel = (e: React.WheelEvent) => {
    const { x, y } = toViewport(e);
    sendInput({ kind: 'wheel', x, y, deltaX: -e.deltaX, deltaY: -e.deltaY });
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault();
    const printable = e.key.length === 1;
    sendInput({
      kind: 'key', eventType: 'keyDown', key: e.key, code: e.code,
      text: printable ? e.key : undefined, windowsVirtualKeyCode: (e as unknown as { keyCode: number }).keyCode,
    });
  };
  const onKeyUp = (e: React.KeyboardEvent) => {
    e.preventDefault();
    sendInput({ kind: 'key', eventType: 'keyUp', key: e.key, code: e.code, windowsVirtualKeyCode: (e as unknown as { keyCode: number }).keyCode });
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
        style={{ cursor: 'default' }}
        onMouseMove={onMouseMove}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onContextMenu={(e) => e.preventDefault()}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
      />
      {status === 'launching' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-xs" style={{ color: '#FF6F00' }}>Launching browser…</div>
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
    </div>
  );
}
