// Shared types for the cm-* companion protocol and the CDP surface.
// Mirrored manually in webview/src/cmProtocol.ts (the webview cannot import from src/).

/** A page->host companion message (cm-element-selected, cm-navigate, ...). Opaque to the relay. */
export interface CmPageToHost {
  type: string;
  [key: string]: unknown;
}

/** A host->page companion message (cm-comment-mode, cm-update-markers, ...). Opaque to the relay. */
export interface CmHostToPage {
  type: string;
  [key: string]: unknown;
}

/** An input event captured over the screencast canvas, forwarded to the page via CDP Input.dispatch*. */
export type CdpInputEvent =
  | {
      kind: 'mouse';
      eventType: 'mouseMoved' | 'mousePressed' | 'mouseReleased';
      x: number;
      y: number;
      button?: 'none' | 'left' | 'middle' | 'right';
      clickCount?: number;
      buttons?: number;
      modifiers?: number;
    }
  | { kind: 'wheel'; x: number; y: number; deltaX: number; deltaY: number; modifiers?: number }
  | {
      kind: 'key';
      eventType: 'keyDown' | 'keyUp' | 'char';
      key?: string;
      code?: string;
      text?: string;
      windowsVirtualKeyCode?: number;
      modifiers?: number;
    };

/** Status of the CDP-driven Chrome instance, surfaced to the webview. */
export type ChromeStatus = 'launching' | 'connected' | 'login' | 'authenticated' | 'crashed';
