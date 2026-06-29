import type { ExtensionMessage } from '../types.js';

/**
 * A preview surface that renders the target app and carries the cm-* protocol.
 * `ProxySurface` (the iframe + local proxy, today's default) and `CdpSurface`
 * (a real Chrome driven over CDP) both implement this so PreviewProvider can be
 * mode-agnostic. Surfaces push messages to the webview via the injected `post` fn.
 */
export interface BrowserSurface {
  readonly kind: 'proxy' | 'cdp';
  /** Start the surface against the given target URL. */
  start(targetUrl: string): Promise<void>;
  /** Navigate the surface to a new URL (same or different origin). */
  navigate(url: string): void;
  /** Tear down: stop the proxy / kill Chrome / close sockets. */
  dispose(): void;
}

export type PostToWebview = (msg: ExtensionMessage) => void;

export function safeOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}
