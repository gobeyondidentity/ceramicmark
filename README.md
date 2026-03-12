# CeramicMark

An extension that lets product builders leave visual, pin-based comments directly on a live localhost preview — inside VS Code and Cursor.

Drop threaded comment pins directly onto a running app preview. No switching tools, no screenshots, no Slack threads with "the button on the left... no the other one."

---

## How it works

1. Open any project in VS Code or Cursor
2. Start your dev server as normal (`npm run dev`, etc.)
3. Open the CeramicMark panel from the activity bar
4. On the splash screen, enter your localhost URL (e.g. `http://localhost:3000`) and press Enter
5. Click **Comment**, then click anywhere on the preview to drop a pin
6. Your teammate pulls the repo, opens CeramicMark, and sees your pins

Comments are stored in `.ide-comments/comments.json` inside your project — they travel with the repo, so no account or external service is needed.

---

## Features

- **Visual pin-based comments** — click anywhere on the live preview to drop a comment pin
- **Threaded replies** — reply to any comment directly in the pin popover
- **Resolve / reopen** — mark comments as resolved when the issue is addressed
- **@mentions** — type `@` in any comment or reply to mention a teammate by name
- **Read/unread tracking** — new comments from others are marked unread with a dot indicator (session-based)
- **Branch-scoped comments** — comments store the branch they were made on; pins from other branches are dimmed so you always know what's current
- **Current branch display** — the active git branch is shown in the toolbar header

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

> **Coming soon:** An onboarding setting on first use that lets you choose whether to commit comments to the repo or keep them gitignored locally. For now, managing `.gitignore` manually is the way to go.

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
- [ ] GitHub/GitLab sign-in for verified identity and avatars
- [ ] Onboarding setting: choose commit vs. gitignore for comment storage
- [ ] Link comment pins directly to specific lines of source code
