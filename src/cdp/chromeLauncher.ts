import * as http from 'http';
import * as net from 'net';
import * as fs from 'fs';
import { execFileSync } from 'child_process';
import { spawn, type ChildProcess } from 'child_process';
import type { OutputChannel } from 'vscode';

/** Thrown by launchChrome when no Chrome/Edge/Chromium binary can be located. */
export class ChromeNotFoundError extends Error {
  constructor() {
    super('No Chrome, Edge, or Chromium binary found');
    this.name = 'ChromeNotFoundError';
  }
}

export interface LaunchedChrome {
  process: ChildProcess;
  /** Browser-level WebSocket debugger URL (from /json/version). */
  wsEndpoint: string;
  port: number;
  /** Resolved browser executable path (used to raise the OS window on login). */
  binPath: string;
}

/** Locate a Chromium-family browser. Honors an explicit configured path first. */
export function findBrowserPath(configuredPath?: string): string | undefined {
  if (configuredPath && fs.existsSync(configuredPath)) return configuredPath;

  const candidates: string[] = [];
  if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      `${process.env.HOME}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    );
  } else if (process.platform === 'win32') {
    const pf = process.env['PROGRAMFILES'] ?? 'C:\\Program Files';
    const pfx86 = process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)';
    const local = process.env['LOCALAPPDATA'] ?? '';
    candidates.push(
      `${pf}\\Google\\Chrome\\Application\\chrome.exe`,
      `${pfx86}\\Google\\Chrome\\Application\\chrome.exe`,
      `${local}\\Google\\Chrome\\Application\\chrome.exe`,
      `${pf}\\Microsoft\\Edge\\Application\\msedge.exe`,
      `${pfx86}\\Microsoft\\Edge\\Application\\msedge.exe`,
    );
  } else {
    // linux — try PATH lookups first, then common absolute paths
    for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']) {
      try {
        const p = execFileSync('which', [name], { encoding: 'utf8' }).trim();
        if (p) return p;
      } catch {
        /* not on PATH */
      }
    }
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/microsoft-edge',
    );
  }
  return candidates.find((p) => fs.existsSync(p));
}

/** Find a free TCP port on the loopback interface. */
function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(port));
    });
  });
}

/** Poll /json/version until Chrome's debugger endpoint is ready (or time out). */
function waitForDebugger(port: number, timeoutMs: number): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = (): void => {
      const req = http.get({ host: '127.0.0.1', port, path: '/json/version' }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          try {
            const json = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            if (json.webSocketDebuggerUrl) return resolve(json.webSocketDebuggerUrl);
          } catch {
            /* not ready */
          }
          retry();
        });
      });
      req.on('error', retry);
      req.setTimeout(1000, () => req.destroy());
    };
    const retry = (): void => {
      if (Date.now() > deadline) return reject(new Error('Timed out waiting for Chrome debugger'));
      setTimeout(attempt, 250);
    };
    attempt();
  });
}

/**
 * Launch a Chromium-family browser with remote debugging enabled and an isolated,
 * persistent profile (so SSO sessions survive across previews, but the user's real
 * Chrome profile is never touched). The debug port is bound to 127.0.0.1 only.
 */
export async function launchChrome(opts: {
  url: string;
  userDataDir: string;
  browserPath?: string;
  log?: OutputChannel;
}): Promise<LaunchedChrome> {
  const bin = findBrowserPath(opts.browserPath);
  if (!bin) throw new ChromeNotFoundError();

  // If a prior CeramicMark-launched Chrome is still holding this isolated profile, a new
  // launch would just hand off to it and never open its own debug port. Kill any such
  // instance first (matched by our profile path, so the user's real Chrome is untouched).
  if (process.platform !== 'win32') {
    try {
      execFileSync('pkill', ['-f', opts.userDataDir], { stdio: 'ignore' });
      await new Promise((r) => setTimeout(r, 400));
    } catch {
      /* no matching process */
    }
  }

  fs.mkdirSync(opts.userDataDir, { recursive: true });
  const port = await getFreePort();
  const args = [
    `--remote-debugging-port=${port}`,
    '--remote-debugging-address=127.0.0.1',
    `--user-data-dir=${opts.userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    // Keep rendering/screencasting even when the window is parked off-screen or backgrounded.
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
    '--disable-features=Translate,CalculateNativeWinOcclusion',
    '--new-window',
    opts.url,
  ];
  opts.log?.appendLine(`[cdp] launching ${bin} on debug port ${port}`);
  const child = spawn(bin, args, { stdio: 'ignore', detached: false });
  child.on('error', (err) => opts.log?.appendLine(`[cdp] chrome spawn error: ${err.message}`));

  const wsEndpoint = await waitForDebugger(port, 15000);
  opts.log?.appendLine(`[cdp] debugger ready: ${wsEndpoint}`);
  return { process: child, wsEndpoint, port, binPath: bin };
}

/**
 * Raise the launched browser's OS window above the editor. CDP's Page.bringToFront only
 * activates the tab within Chrome — it does not raise the app window above VS Code — so we
 * activate at the OS level. macOS only for now (the spike platform); no-op elsewhere.
 */
export function bringBrowserToFront(binPath: string, log?: OutputChannel): void {
  if (process.platform !== 'darwin') return;
  const appIdx = binPath.indexOf('.app');
  const appPath = appIdx === -1 ? binPath : binPath.slice(0, appIdx + 4);
  try {
    spawn('open', ['-a', appPath], { stdio: 'ignore', detached: false });
  } catch (err) {
    log?.appendLine(`[cdp] bringBrowserToFront failed: ${(err as Error).message}`);
  }
}
