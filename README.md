# CeramicMark

Figma-style visual comment pins on live UI previews, inside VS Code and Cursor.

Designers and developers can drop threaded comment pins directly onto a running app preview — no switching tools, no screenshots, no Slack threads with "the button on the left... no the other one."

---

## How it works

1. Open any project in VS Code or Cursor
2. Start your dev server as normal (`npm run dev`, etc.)
3. Open the CeramicMark panel from the activity bar
4. Enter your localhost URL (e.g. `http://localhost:3000`)
5. Click **Comment**, then click anywhere on the preview to drop a pin
6. Your teammate pulls the repo, opens CeramicMark, and sees your pins

Comments are stored in `.ide-comments/comments.json` inside your project — they travel with the repo, so no account or external service is needed.

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
- [ ] @mentions and notifications
- [ ] Link comment pins directly to specific lines of source code
