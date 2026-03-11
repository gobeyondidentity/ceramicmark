/**
 * VS Code Webview API bridge.
 * `acquireVsCodeApi()` is only available inside the actual webview.
 * This file provides a typed wrapper and a no-op fallback for local Vite dev.
 */

import type { ExtensionMessage, WebviewMessage } from './types.js';

export type { ExtensionMessage, WebviewMessage };

interface VsCodeApi {
  postMessage(message: WebviewMessage): void;
  getState<T>(): T | undefined;
  setState<T>(state: T): T;
}

declare function acquireVsCodeApi(): VsCodeApi;

function createApi(): VsCodeApi {
  if (typeof acquireVsCodeApi !== 'undefined') {
    return acquireVsCodeApi();
  }
  // Fallback for local Vite dev server
  return {
    postMessage: (msg) => console.log('[vscode stub] postMessage', msg),
    getState: () => undefined,
    setState: (s) => s,
  };
}

export const vscodeApi = createApi();
