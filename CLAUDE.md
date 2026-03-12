# CeramicMark — Claude Code Guide

## What this project is

A VS Code extension that lets product builders leave visual, pin-based comments directly on a live localhost preview. Comments are stored in `.ide-comments/comments.json` and travel with the repo.

## Project structure

```
src/                        Extension host (Node.js, runs in VS Code)
  extension.ts              Activation, command registration, file watcher
  providers/
    previewProvider.ts      Webview panel lifecycle, message handling, gitignore prompt
    commentTreeProvider.ts  Sidebar tree view
  store/
    fileStore.ts            Reads/writes .ide-comments/comments.json
    memberStore.ts          Reads/writes .ide-comments/members.json
  auth/
    gitIdentity.ts          getGitIdentity(), getGitBranch() via execFile
  types.ts                  Shared types: Comment, Reply, WebviewMessage, ExtensionMessage

webview/src/                React app (bundled by Vite, runs inside the webview)
  App.tsx                   Root component, reducer, message handler
  Toolbar.tsx               Header: logo, URL input, comment/pin toggle buttons, branch row
  PreviewFrame.tsx          iframe + CommentOverlay container
  CommentOverlay.tsx        Pin rendering, draft pin, edge-aware popover flip logic
  CommentThread.tsx         Threaded comment popover (resolve, delete, reply)
  types.ts                  Mirror of src/types.ts — keep in sync manually
  index.css                 Global styles, VS Code CSS variable mappings

images/                     Extension icons and splash background (cm_bg.png)
dist/                       Build output — never edit directly
```

## Build

```bash
npm run compile        # build both extension + webview (production)
npm run watch:ext      # watch extension host only
npm run watch:webview  # watch webview only (Vite dev server)
```

Launch for development: `Fn+F5` in VS Code opens an Extension Development Host.

## Key conventions

- **Types must stay in sync**: `src/types.ts` is the source of truth. `webview/src/types.ts` is a manual mirror — update both when adding message types.
- **Primary color**: `#FF6F00` (orange). Used for active states, borders, branch row background.
- **Font**: `var(--vscode-editor-font-family)` — inherits user's configured monospace font.
- **VS Code CSS variables**: Use `var(--vscode-*)` for all theme-sensitive colors. Hardcode only `#FF6F00` and white/black.
- **Comment storage**: `.ide-comments/comments.json` — `{ version: 1, comments: [...] }`. Never break this schema; additions must be backward-compatible (optional fields only).
- **No external network calls**: The extension must work fully offline. No CDN fonts, no analytics, no remote URLs.
- **CSP**: The webview CSP blocks external resources. All assets (SVGs, images) must be bundled or served via `webview.asWebviewUri()`.

## Message flow

```
Webview → Extension:  WebviewMessage  (postMessage from vscodeApi)
Extension → Webview:  ExtensionMessage (postMessage from panel.webview)
```

All message types are defined in `src/types.ts` / `webview/src/types.ts`.

## Splash screen vs loaded state

- **No URL set** (`state.previewUrl === ''`): renders `<SplashScreen>` — fullscreen background image, logo, centered URL input. Toolbar is hidden.
- **URL set**: renders `<Toolbar>` + `<PreviewFrame>` as normal.

## Comment pin popover positioning

Popovers flip horizontally/vertically when the pin is near an edge, computed from the pin's percentage position and `containerSize` (measured via `ResizeObserver`). Logic lives in `CommentOverlay.tsx`.

## State management (webview)

Single `useReducer` in `App.tsx`. All extension→webview messages dispatch actions. Read/unread tracking is session-only (`Set<string>` in state, never persisted).

## workspaceState keys

- `gitignorePrompted` (boolean) — whether the user has been asked about adding `.ide-comments/` to `.gitignore`
