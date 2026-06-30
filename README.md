# CeramicMark

An extension that lets product builders leave visual comments directly on a live app preview — inside VS Code and Cursor. Comment on any element of your running app, **including pages behind a login or single sign-on**.

Click any element in the running app to anchor a comment to it. No switching tools, no screenshots, no Slack threads with "the button on the left... no the other one."

---

## Install

Install from the Visual Studio Marketplace: search **CeramicMark** in the Extensions view (`Cmd+Shift+X`), or visit the [Marketplace listing](https://marketplace.visualstudio.com/items?itemName=beyondidentity.ceramic-mark). Works in VS Code and Cursor.

To run from source instead, see [Dev setup](#dev-setup-running-from-source) below.

---

## How it works

1. Open any project in VS Code or Cursor
2. Start your dev server as normal (`npm run dev`, etc.)
3. Open the CeramicMark panel from the activity bar
4. On the splash screen, enter your dev server URL — `localhost`, a port, a path, or a LAN IP all work (e.g. `http://localhost:3000`, `localhost:5173/dashboard`, `192.168.1.5:3000`) — and press Enter
5. Press **C** (or click the Comment button) to enter comment mode — the preview gets an orange border
6. Click any element in the preview to anchor a comment to it
7. Your teammate pulls the repo, opens CeramicMark, and sees your comment markers on the same elements

Comments are stored in `.ide-comments/comments.json` inside your project — they travel with the repo, so no account or external service is needed.

---

## Preview modes

CeramicMark has two ways to render your app. You switch between them with the **Proxy / Browser** toggle in the toolbar, and CeramicMark will auto-switch when it needs to.

- **Proxy mode** (default) — a fast preview of your dev server inside the panel. Great for `localhost`, LAN IPs, subpages, HTTPS dev servers, and apps with their own login page.
- **Browser mode** — previews your app in a **real Chrome/Edge instance**, driven behind the scenes and streamed into the panel (with mouse, scroll, and keyboard). This is what makes **cross-origin single sign-on** work: you log in normally in the real browser, then comment on the authenticated app right inside VS Code. CeramicMark **auto-switches to Browser mode** when it detects your app redirecting to a separate sign-in site (e.g. Keycloak/Okta/Auth0).

Browser mode launches the Chrome/Edge already installed on your machine, in its own isolated profile — it never touches your day-to-day browser profile.

---

## Features

### Commenting
- **Element-anchored comments** — click any element in the live preview to attach a comment directly to it; a marker badge appears on the element for all teammates
- **Smart element labels** — comments are labeled using `aria-label`, placeholder text, alt text, heading content, or element ID so you always know what was clicked
- **Marker persistence** — badges reappear automatically as you navigate between pages and views, including React-state apps that never change the URL
- **Threaded replies** — reply to any comment directly in the sidebar
- **Resolve / reopen** — mark comments as resolved when the issue is addressed; resolved comments move to the Resolved tab and their markers are removed from the preview
- **@mentions** — type `@` in any comment or reply to mention a teammate by name
- **Read/unread tracking** — new comments from others are marked unread with a dot indicator (session-based)

### Comment sidebar
- **Page-scoped by default** — the sidebar shows comments for the page you're currently viewing; a **page dropdown** lets you switch to any other page (with counts) or see all pages at once
- **Jump to any comment** — click a comment to navigate the preview to its page (even across routes) and highlight the element; hover a card to see a dashed outline without navigating
- **Comments / Resolved tabs** — segmented control to switch between open and resolved comments
- **Orphaned comment handling** — if a comment's element no longer exists on the page, the sidebar shows a warning icon, the comment box shows an **"Element no longer exists"** tag, and the comment sorts to the bottom of the list
- **Branch-scoped view** — comments store the branch they were made on; the toolbar shows the active git branch and updates automatically when you switch branches; comments from other branches are hidden
- **Commit reminder** — a toast appears at every 10-comment milestone when `.ide-comments/` has uncommitted changes, so you don't forget to share with the team

### Preview & navigation
- **Address bar with path navigation** — the URL bar is a full address bar: enter any path (e.g. `localhost:3000/dashboard`) to open it directly, and the bar tracks your in-app navigation so you always know which page you're on. Switch origin (including a LAN IP) anytime by typing it and pressing Enter
- **IP address support** — preview a dev server bound to a network IP (e.g. `192.168.1.5:3000`), not just `localhost`
- **HTTPS dev servers** — preview servers served over `https://`, including self-signed certs common in local dev
- **Works behind a login** — apps with their own sign-in page work in Proxy mode (session cookies and redirects are preserved). For **cross-origin single sign-on** (a separate Keycloak/Okta/Auth0 host), Browser mode runs the real login and lets you comment on the authenticated app
- **Real-browser (Browser) mode** — preview in a real Chrome/Edge streamed into the panel; the browser window comes forward for native sign-in, then hands you back to the embedded view; follows links that open new tabs/popups
- **Back / Forward / Refresh** — browser navigation controls in Browser mode (Back also un-strands you from a tab a link opened); `⌘R` / `Ctrl+R` refreshes the previewed page in either mode
- **Pin visibility toggle** — hide or show all comment pins with the eye icon or `V` key, so you can view the page without visual clutter

### General
- **Keyboard shortcuts** — `C` toggles comment mode; `R` resolves/reopens the focused comment; `V` toggles pin visibility; `S` toggles sidebar; `⌘R` refreshes the preview; `Esc` exits comment mode
- **Sidebar** — closed by default; open it with `S` or the toolbar toggle; auto-collapses on narrow panels
- **Version label** — current extension version shown at the bottom of the splash screen for quick identification

---

## Settings

- `ceramicMark.browserPath` — absolute path to a Chrome, Edge, or Chromium executable for Browser mode. Leave empty to auto-detect; set it if your browser is installed somewhere unusual.

Browser mode requires a Chromium-family browser (Chrome, Edge, or Chromium) installed on your machine.

---

## Dev setup (running from source)

Use this if you want to run the latest unreleased code, or develop CeramicMark itself, rather than installing from the Marketplace.

**Requirements:** Node.js, VS Code, and (for Browser mode) Chrome/Edge/Chromium

1. Clone the repo and open it in VS Code:
   ```bash
   git clone https://github.com/gobeyondidentity/ceramicmark
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

7. Click the CeramicMark icon in the activity bar, enter your dev server URL on the splash screen, and press Enter

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
- [ ] Standalone CLI mode — run as a local web app (`ceramicmark serve`) outside VS Code, using the same comment storage
- [ ] Upgrade Vite to v8 in the webview — resolves remaining esbuild dev-server vulnerability; deferred as a breaking change requiring config migration *(low urgency: only affects local dev, not published extension)*
- [ ] Auto-detect running dev servers on the splash screen — scan common localhost ports (3000, 3001, 4000, 5173, 8080, etc.) on activation and pre-fill the URL input with the detected address so the user only needs to press Enter; if multiple servers are found, show a small dropdown below the input listing all candidates so the user can select the right one before confirming
