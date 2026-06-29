import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
import type { OutputChannel } from 'vscode';

interface Pending {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
}

/**
 * Minimal Chrome DevTools Protocol client over a single browser-level WebSocket,
 * using "flatten" mode so session-scoped commands carry a sessionId on one socket.
 * Events are emitted by their CDP method name; the listener receives (params, sessionId).
 */
export class CdpClient extends EventEmitter {
  private ws: WebSocket | undefined;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();

  constructor(private readonly wsUrl: string, private readonly log?: OutputChannel) {
    super();
    this.setMaxListeners(50);
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
      this.ws = ws;
      ws.on('open', () => resolve());
      ws.on('error', (err) => {
        this.log?.appendLine(`[cdp] ws error: ${err.message}`);
        reject(err);
        this.emit('__error', err);
      });
      ws.on('close', () => this.emit('__close'));
      ws.on('message', (data: Buffer) => this.onMessage(data));
    });
  }

  private onMessage(data: Buffer): void {
    let msg: { id?: number; result?: unknown; error?: { message: string }; method?: string; params?: unknown; sessionId?: string };
    try {
      msg = JSON.parse(data.toString('utf8'));
    } catch {
      return;
    }
    if (typeof msg.id === 'number') {
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message));
      else p.resolve(msg.result);
    } else if (msg.method) {
      this.emit(msg.method, msg.params ?? {}, msg.sessionId);
    }
  }

  send<T = unknown>(method: string, params: Record<string, unknown> = {}, sessionId?: string): Promise<T> {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return Promise.reject(new Error('CDP socket not open'));
    const id = this.nextId++;
    const payload: Record<string, unknown> = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      ws.send(JSON.stringify(payload), (err) => {
        if (err) {
          this.pending.delete(id);
          reject(err);
        }
      });
    });
  }

  /** Attach to the first available page target (flatten mode) and return its sessionId. */
  async attachToFirstPage(timeoutMs = 8000): Promise<{ sessionId: string; targetId: string }> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const { targetInfos } = await this.send<{ targetInfos: Array<{ targetId: string; type: string; url: string }> }>(
        'Target.getTargets',
      );
      const page = targetInfos.find((t) => t.type === 'page');
      if (page) {
        const { sessionId } = await this.send<{ sessionId: string }>('Target.attachToTarget', {
          targetId: page.targetId,
          flatten: true,
        });
        return { sessionId, targetId: page.targetId };
      }
      if (Date.now() > deadline) throw new Error('No page target found to attach to');
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  close(): void {
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
    this.pending.clear();
  }
}
