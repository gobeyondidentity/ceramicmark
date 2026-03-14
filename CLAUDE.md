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

## Design instructions

### Primary color
- The primary color is `#FF6F00` (orange).
- Use it for: active/selected states, input borders, button backgrounds, branch row background, pin markers, comment mode border, and any accent that needs to draw attention.
- Never introduce a second accent color. Use `#FF6F00` at reduced opacity (e.g. `rgba(255,111,0,0.4)`) for subtle variants.
- For text on top of `#FF6F00` backgrounds, use `var(--vscode-titleBar-activeBackground, #3c3c3c)` (dark) to ensure contrast.
- For all other colors, use `var(--vscode-*)` CSS variables so the UI respects the user's VS Code theme.

### Icons
- Always use Bootstrap Icons for any new icon.
- The webview CSP blocks external resources — never link to a CDN. Inline the Bootstrap Icon SVG directly in JSX.
- Use `fill="currentColor"` (or `fill={currentColor}`) so icons inherit their parent's text color.
- Standard icon size is `width="12" height="12"` for toolbar/header contexts and `width="14" height="14"` for larger UI areas.
- Browse available icons at: https://icons.getbootstrap.com

### Font
- Always use `var(--vscode-editor-font-family, 'SF Mono', Consolas, 'Cascadia Code', Menlo, monospace)` — this is already set globally in `webview/src/index.css` and inherited everywhere.
- Do not set a custom `font-family` on individual elements. Do not introduce any other font.

### Accessibility
- This tool must conform to **WCAG 2.0 Level AA** at all times.
- Every UI addition must include:
  - Accessible names for all interactive elements (`aria-label`, `<label>`, or visible text).
  - `aria-hidden="true"` on all purely decorative elements (icons, logos).
  - Correct semantic roles: use `<button>` for clickable cards/actions, `<h1>`–`<h6>` for headings, `role="listbox"` / `role="option"` for custom dropdowns.
  - `aria-pressed` on toggle buttons, `aria-expanded` on disclosure widgets.
  - Sufficient color contrast: text on `#FF6F00` backgrounds must use the dark VS Code title-bar color; never pair low-opacity text with a low-contrast background.
  - Focus-visible indicators (do not suppress `:focus-visible` outlines).
- **Claude must proactively flag any request that would result in a WCAG 2.0 AA violation** before implementing it, and suggest a compliant alternative.

## Key conventions

- **Types must stay in sync**: `src/types.ts` is the source of truth. `webview/src/types.ts` is a manual mirror — update both when adding message types.
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
