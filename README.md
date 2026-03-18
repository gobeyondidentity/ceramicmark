# CeramicMark

An extension that lets product builders leave visual comments directly on a live localhost preview — inside VS Code and Cursor.

Click any element in the running app to anchor a comment to it. No switching tools, no screenshots, no Slack threads with "the button on the left... no the other one."

---

## How it works

1. Open any project in VS Code or Cursor
2. Start your dev server as normal (`npm run dev`, etc.)
3. Open the CeramicMark panel from the activity bar
4. On the splash screen, enter your localhost URL (e.g. `http://localhost:3000`) and press Enter
5. Press **C** (or click the Comment button) to enter comment mode — the preview gets an orange border
6. Click any element in the preview to anchor a comment to it
7. Your teammate pulls the repo, opens CeramicMark, and sees your comment markers on the same elements

Comments are stored in `.ide-comments/comments.json` inside your project — they travel with the repo, so no account or external service is needed.

---

## Features

- **Element-anchored comments** — click any element in the live preview to attach a comment directly to it; a marker badge appears on the element for all teammates
- **Smart element labels** — comments are labeled using `aria-label`, placeholder text, alt text, heading content, or element ID so you always know what was clicked
- **Marker persistence** — badges reappear automatically as you navigate between pages and views, including React-state apps that never change the URL
- **Sidebar comment list** — all comments listed in a collapsible sidebar; click any comment to jump to and highlight the element in the preview; hover a comment card to see a dashed outline on the element without navigating
- **Comments / Resolved tabs** — sidebar has a segmented control to switch between open and resolved comments
- **Threaded replies** — reply to any comment directly in the sidebar
- **Resolve / reopen** — mark comments as resolved when the issue is addressed; resolved comments move to the Resolved tab and their markers are removed from the preview
- **@mentions** — type `@` in any comment or reply to mention a teammate by name
- **Read/unread tracking** — new comments from others are marked unread with a dot indicator (session-based)
- **Branch-scoped view** — comments store the branch they were made on; the toolbar shows the active git branch and updates automatically when you switch branches; comments from other branches are hidden
- **Commit reminder** — a toast appears at every 10-comment milestone when `.ide-comments/` has uncommitted changes, so you don't forget to share with the team
- **Orphaned comment indicator** — if the element a comment was anchored to no longer exists in the DOM, a warning icon appears on the sidebar card so teammates know the anchor is stale
- **Keyboard shortcuts** — `C` toggles comment mode (Figma-style); `R` resolves (or reopens) the focused comment; `Esc` exits comment mode
- **Responsive sidebar** — auto-collapses below 640px so the preview always gets enough space
- **Version label** — current extension version shown at the bottom of the splash screen for quick identification

---

## Dev setup (running from source)

Use this if CeramicMark isn't on the marketplace yet and you need to run it locally.

**Requirements:** Node.js, VS Code

1. Clone the repo and open it in VS Code:
   ```bash
   git clone https://github.com/ceramicmark/ceramic-mark
   cd ceramic-mark
   code .
   ```

2. Install dependencies:
   ```bash
   npm install
   cd webview && npm install && cd ..
   ```

3. Launch the extension: **Run → Start Debugging** (or `Fn+F5` on Mac)

4. A new **Extension Development Host** window opens — this is where CeramicMark is active

5. In that new window, open the project you want to use CeramicMark on: **File → Open Folder**

6. Start your dev server for that project (e.g. `npm run dev`)

7. Click the CeramicMark icon in the activity bar, enter your localhost URL on the splash screen, and press Enter

---

## Comment privacy

Comments are stored as a file inside your project folder. This means:

- **Private repository** — your comments are private. Only people with repo access can see them.
- **Public repository** — comments will be visible to anyone who views the repo on GitHub.

**If you're working in a public repo and want to keep comments local only**, add this to your `.gitignore`:

```
.ide-comments/
```

This keeps the comment file on your machine but prevents it from being committed and shared.

---

## Identity

CeramicMark reads your name and email from your git config automatically — no login required. Your comments are attributed to whoever's git identity is configured on that machine.

To check yours:
```bash
git config user.name
git config user.email
```

---

## Roadmap

- [ ] Cloud sync with real-time collaboration (comments appear live as teammates add them)
- [ ] GitHub/GitLab sign-in for verified identity and avatars *(currently deferred — git config identity is sufficient for internal teams using git-based storage; sign-in becomes worthwhile as a prerequisite for cloud sync, where there's no commit audit trail to fall back on)*
- [ ] Onboarding setting: choose commit vs. gitignore for comment storage
- [ ] Link comment pins directly to specific lines of source code
- [ ] Standalone browser mode — run as a local web app (`ceramicmark serve`) without VS Code, using the same HTTP proxy and comment storage
- [ ] Upgrade Vite to v8 in the webview — resolves remaining esbuild dev-server vulnerability; deferred as a breaking change requiring config migration *(low urgency: only affects local dev, not published extension)*
