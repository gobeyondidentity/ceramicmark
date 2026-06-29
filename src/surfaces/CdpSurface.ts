import type { OutputChannel } from 'vscode';
import type { ChromeStatus, CdpInputEvent } from '../companion/cmProtocol.js';
import { launchChrome, bringBrowserToFront, ChromeNotFoundError, type LaunchedChrome } from '../cdp/chromeLauncher.js';
import { CdpClient } from '../cdp/cdpClient.js';
import { type BrowserSurface, type PostToWebview, safeOrigin } from './BrowserSurface.js';

/**
 * CDP-driven "real browser" surface. CP1 scope: launch a dedicated Chrome instance at the
 * target, attach over CDP, and drive the hybrid login pop-out — when the top frame navigates
 * cross-origin (to the IdP) bring Chrome to front so the user signs in natively, and detect
 * the return to the app origin. Screencast + companion injection + input forwarding land in
 * later checkpoints.
 */
export class CdpSurface implements BrowserSurface {
  readonly kind = 'cdp' as const;
  private launched: LaunchedChrome | undefined;
  private client: CdpClient | undefined;
  private sessionId: string | undefined;
  private appOrigin = '';
  private status: ChromeStatus = 'launching';
  private viewport = { width: 1280, height: 800, dpr: 1 };
  private screencasting = false;
  private windowId: number | undefined;
  private offscreenTimer: ReturnType<typeof setTimeout> | undefined;
  private offscreen = false;
  private frameCount = 0;
  private lastError: string | undefined;

  private postDebug(): void {
    this.post({ type: 'cdpDebug', produced: this.frameCount, screencasting: this.screencasting, error: this.lastError });
  }

  constructor(
    private readonly userDataDir: string,
    private readonly post: PostToWebview,
    private readonly browserPath: string | undefined,
    private readonly log?: OutputChannel,
  ) {}

  async start(targetUrl: string): Promise<void> {
    this.appOrigin = safeOrigin(targetUrl);
    this.status = 'launching';
    this.post({ type: 'chromeStatus', status: 'launching', url: targetUrl });

    let launched: LaunchedChrome;
    try {
      launched = await launchChrome({
        url: targetUrl,
        userDataDir: this.userDataDir,
        browserPath: this.browserPath,
        log: this.log,
      });
    } catch (err) {
      if (err instanceof ChromeNotFoundError) {
        this.post({ type: 'chromeNotFound' });
        return;
      }
      this.log?.appendLine(`[cdp] launch failed: ${(err as Error).message}`);
      this.post({ type: 'chromeStatus', status: 'crashed' });
      return;
    }
    this.launched = launched;

    const client = new CdpClient(launched.wsEndpoint, this.log);
    this.client = client;
    await client.connect();
    client.on('__close', () => {
      if (this.status !== 'crashed') {
        this.status = 'crashed';
        this.post({ type: 'chromeStatus', status: 'crashed' });
      }
    });

    const { sessionId, targetId } = await client.attachToFirstPage();
    this.sessionId = sessionId;
    await client.send('Page.enable', {}, sessionId);
    await client.send('Runtime.enable', {}, sessionId);
    client.on('Page.frameNavigated', (params) => this.onFrameNavigated(params as FrameNavigatedParams));
    client.on('Page.screencastFrame', (params) => this.onScreencastFrame(params as ScreencastFrameParams));

    // Grab the OS window id so we can park it off-screen (keeps it compositing → live frames,
    // without occluding behind the editor) and bring it on-screen only for login.
    try {
      const w = await client.send<{ windowId: number }>('Browser.getWindowForTarget', { targetId });
      this.windowId = w.windowId;
    } catch (err) {
      this.log?.appendLine(`[cdp] getWindowForTarget failed: ${(err as Error).message}`);
    }

    this.status = 'connected';
    this.post({ type: 'chromeStatus', status: 'connected', url: targetUrl });
    await this.applyViewportAndScreencast();

    // Handle the case where the redirect to the IdP already happened before we subscribed.
    try {
      const r = await client.send<{ result?: { value?: string } }>(
        'Runtime.evaluate',
        { expression: 'location.href', returnByValue: true },
        sessionId,
      );
      const curOrigin = safeOrigin(r.result?.value ?? '');
      if (curOrigin && curOrigin !== this.appOrigin) {
        this.enterLogin(r.result?.value ?? '');
      } else {
        this.scheduleHideIfStable();
      }
    } catch {
      this.scheduleHideIfStable();
    }
  }

  /** Park the browser window off-screen: it keeps compositing (frames flow) but stays out of the way. */
  private moveOffScreen(): void {
    clearTimeout(this.offscreenTimer);
    if (!this.client || this.windowId == null || this.offscreen) return;
    this.offscreen = true;
    this.client
      .send('Browser.setWindowBounds', {
        windowId: this.windowId,
        bounds: { left: -5000, top: 0, width: Math.max(800, this.viewport.width), height: Math.max(600, this.viewport.height), windowState: 'normal' },
      })
      .catch(() => undefined);
  }

  /** Bring the browser window on-screen and focus it (for native login). */
  private moveOnScreen(): void {
    clearTimeout(this.offscreenTimer);
    this.offscreen = false;
    if (this.client && this.windowId != null) {
      this.client
        .send('Browser.setWindowBounds', {
          windowId: this.windowId,
          bounds: { left: 80, top: 80, width: 1100, height: 850, windowState: 'normal' },
        })
        .catch(() => undefined);
    }
    if (this.launched) bringBrowserToFront(this.launched.binPath, this.log);
  }

  /** Hide the window shortly after the app settles on its own origin (no pending auth redirect). */
  private scheduleHideIfStable(): void {
    clearTimeout(this.offscreenTimer);
    this.offscreenTimer = setTimeout(() => {
      if (this.status === 'connected' || this.status === 'authenticated') this.moveOffScreen();
    }, 1500);
  }

  private enterLogin(url: string): void {
    this.status = 'login';
    this.client?.send('Page.bringToFront', {}, this.sessionId).catch(() => undefined);
    this.moveOnScreen();
    this.post({ type: 'chromeStatus', status: 'login', url });
    this.post({ type: 'requestLoginPopout' });
  }

  /** Update the rendered viewport to match the webview panel, and (re)start the screencast. */
  async setViewport(cssWidth: number, cssHeight: number, dpr: number): Promise<void> {
    this.viewport = {
      width: Math.max(1, Math.round(cssWidth)),
      height: Math.max(1, Math.round(cssHeight)),
      dpr: dpr || 1,
    };
    await this.applyViewportAndScreencast();
  }

  private async applyViewportAndScreencast(): Promise<void> {
    if (!this.client || !this.sessionId) return;
    const { width, height, dpr } = this.viewport;
    try {
      await this.client.send(
        'Emulation.setDeviceMetricsOverride',
        { width, height, deviceScaleFactor: dpr, mobile: false },
        this.sessionId,
      );
      if (this.screencasting) {
        await this.client.send('Page.stopScreencast', {}, this.sessionId).catch(() => undefined);
      }
      await this.client.send(
        'Page.startScreencast',
        { format: 'png', maxWidth: Math.round(width * dpr), maxHeight: Math.round(height * dpr), everyNthFrame: 1 },
        this.sessionId,
      );
      this.screencasting = true;
      this.lastError = undefined;
    } catch (err) {
      this.lastError = (err as Error).message;
      this.log?.appendLine(`[cdp] screencast error: ${this.lastError}`);
    }
    this.postDebug();
  }

  private onScreencastFrame(p: ScreencastFrameParams): void {
    if (!this.client || !this.sessionId) return;
    this.client.send('Page.screencastFrameAck', { sessionId: p.sessionId }, this.sessionId).catch(() => undefined);
    this.frameCount++;
    if (this.frameCount === 1 || this.frameCount % 30 === 0) {
      this.log?.appendLine(`[cdp] screencast frames sent to webview: ${this.frameCount}`);
      this.postDebug();
    }
    const m = p.metadata ?? {};
    this.post({
      type: 'screencastFrame',
      dataUri: `data:image/png;base64,${p.data}`,
      deviceWidth: m.deviceWidth ?? this.viewport.width,
      deviceHeight: m.deviceHeight ?? this.viewport.height,
      pageScaleFactor: m.pageScaleFactor ?? 1,
      scrollOffsetX: m.scrollOffsetX ?? 0,
      scrollOffsetY: m.scrollOffsetY ?? 0,
    });
  }

  /** Forward a webview-captured input event to the page via CDP Input.dispatch*. */
  dispatchInput(ev: CdpInputEvent): void {
    if (!this.client || !this.sessionId) return;
    const s = this.sessionId;
    if (ev.kind === 'mouse') {
      this.client
        .send('Input.dispatchMouseEvent', {
          type: ev.eventType, x: ev.x, y: ev.y,
          button: ev.button ?? 'none', clickCount: ev.clickCount ?? 0,
          buttons: ev.buttons ?? 0, modifiers: ev.modifiers ?? 0,
        }, s)
        .catch(() => undefined);
    } else if (ev.kind === 'wheel') {
      this.client
        .send('Input.dispatchMouseEvent', {
          type: 'mouseWheel', x: ev.x, y: ev.y, deltaX: ev.deltaX, deltaY: ev.deltaY, modifiers: ev.modifiers ?? 0,
        }, s)
        .catch(() => undefined);
    } else {
      this.client
        .send('Input.dispatchKeyEvent', {
          type: ev.eventType, key: ev.key, code: ev.code, text: ev.text,
          windowsVirtualKeyCode: ev.windowsVirtualKeyCode, modifiers: ev.modifiers ?? 0,
        }, s)
        .catch(() => undefined);
    }
  }

  private onFrameNavigated(params: FrameNavigatedParams): void {
    const frame = params?.frame;
    if (!frame || frame.parentId) return; // top frame only
    const origin = safeOrigin(frame.url);
    if (!origin) return;

    if (origin !== this.appOrigin) {
      // Cross-origin navigation — almost certainly the SSO identity provider.
      // Bring the real Chrome window on-screen so the user authenticates natively.
      if (this.status !== 'login') this.enterLogin(frame.url);
    } else if (this.status === 'login') {
      // Returned to the app origin after the OAuth callback → authenticated; hide the window again.
      this.status = 'authenticated';
      this.post({ type: 'chromeStatus', status: 'authenticated', url: frame.url });
      this.scheduleHideIfStable();
    } else {
      // Normal in-app navigation on our own origin — keep it hidden.
      this.scheduleHideIfStable();
    }
    // A cross-process navigation (esp. cross-origin) can drop the screencast; restart it.
    void this.applyViewportAndScreencast();
  }

  navigate(url: string): void {
    if (this.client && this.sessionId) {
      this.appOrigin = safeOrigin(url) || this.appOrigin;
      this.client.send('Page.navigate', { url }, this.sessionId).catch(() => undefined);
    }
  }

  dispose(): void {
    clearTimeout(this.offscreenTimer);
    try {
      this.client?.close();
    } catch {
      /* ignore */
    }
    try {
      this.launched?.process.kill();
    } catch {
      /* ignore */
    }
    this.client = undefined;
    this.launched = undefined;
    this.sessionId = undefined;
  }
}

interface FrameNavigatedParams {
  frame?: { url: string; parentId?: string };
}

interface ScreencastFrameParams {
  data: string;
  sessionId: number;
  metadata?: {
    deviceWidth?: number;
    deviceHeight?: number;
    pageScaleFactor?: number;
    scrollOffsetX?: number;
    scrollOffsetY?: number;
  };
}
