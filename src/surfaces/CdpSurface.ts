import type { OutputChannel } from 'vscode';
import type { ChromeStatus, CdpInputEvent, CmHostToPage } from '../companion/cmProtocol.js';
import { getCompanionForCdp } from '../companion/companionScript.js';
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
  // The browser window's chrome (title bar / tab strip / omnibox) — the difference between the
  // window's outer size and its web-content area. We size the window so its CONTENT equals the
  // panel, because the screencast captures the content area (not the device-metrics override).
  private chromeDx = 0;
  private chromeDy = 88;
  // Actual rendered size (may be downscaled from the panel to fit the window's display),
  // preserving the panel aspect ratio so the webview upscales to fill with no bars.
  private renderW = 1280;
  private renderH = 800;
  private frameCount = 0;
  private lastError: string | undefined;
  // Multi-target following: the panel screencasts whichever page target is active; new tabs /
  // popups (target=_blank links, OAuth popups) are auto-attached and become active.
  private activeSession: string | undefined;
  private activeTargetId: string | undefined;
  private primaryTargetId: string | undefined;
  private readonly setupSessions = new Set<string>();
  private readonly handledTargets = new Set<string>();

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

    client.on('Runtime.bindingCalled', (params) => this.onBindingCalled(params as BindingCalledParams));
    client.on('Page.frameNavigated', (params, sid) => { if (sid === this.activeSession) this.onFrameNavigated(params as FrameNavigatedParams); });
    client.on('Page.screencastFrame', (params, sid) => { if (sid === this.activeSession) this.onScreencastFrame(params as ScreencastFrameParams); });
    // Auto-attach to new tabs/popups so the panel follows them instead of freezing on the old tab.
    client.on('Target.attachedToTarget', (params) => {
      const p = params as AttachedToTargetParams;
      const id = p.targetInfo?.targetId;
      if (p.targetInfo?.type === 'page' && id && !this.handledTargets.has(id)) {
        void this.switchActive(p.sessionId, id);
      }
    });
    client.on('Target.detachedFromTarget', (params) => {
      const p = params as { sessionId?: string };
      if (p.sessionId && p.sessionId === this.activeSession) void this.fallbackToAnyPage();
    });
    await client.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: true }).catch(() => undefined);

    const first = await client.attachToFirstPage();
    this.primaryTargetId = first.targetId;
    this.status = 'connected';
    this.post({ type: 'chromeStatus', status: 'connected', url: targetUrl });
    await this.switchActive(first.sessionId, first.targetId);
  }

  /** Enable domains + inject the companion into a target's session (once). */
  private async setupSession(sessionId: string): Promise<void> {
    if (!this.client || this.setupSessions.has(sessionId)) return;
    this.setupSessions.add(sessionId);
    const COMPANION = getCompanionForCdp('__cmHostBinding');
    try {
      await this.client.send('Page.enable', {}, sessionId);
      await this.client.send('Runtime.enable', {}, sessionId);
      await this.client.send('Runtime.addBinding', { name: '__cmHostBinding' }, sessionId);
      await this.client.send('Page.addScriptToEvaluateOnNewDocument', { source: COMPANION }, sessionId);
      await this.client.send('Runtime.evaluate', { expression: COMPANION }, sessionId);
    } catch (err) {
      this.log?.appendLine(`[cdp] setupSession failed: ${(err as Error).message}`);
    }
  }

  /** Make a page target the active one: screencast it, inject the companion, and (re)position. */
  private async switchActive(sessionId: string, targetId: string): Promise<void> {
    if (!this.client || sessionId === this.activeSession || targetId === this.activeTargetId) return;
    this.handledTargets.add(targetId);
    if (this.activeSession && this.screencasting) {
      this.client.send('Page.stopScreencast', {}, this.activeSession).catch(() => undefined);
    }
    this.screencasting = false;
    this.activeSession = sessionId;
    this.activeTargetId = targetId;
    this.sessionId = sessionId;
    await this.setupSession(sessionId);
    try {
      const w = await this.client.send<{ windowId: number }>('Browser.getWindowForTarget', { targetId });
      this.windowId = w.windowId;
      this.offscreen = false;
    } catch { /* ignore */ }
    // Measure the window chrome offset (before any device-metrics override skews innerWidth/Height).
    try {
      const d = await this.client.send<{ result?: { value?: string } }>(
        'Runtime.evaluate',
        { expression: 'JSON.stringify([outerWidth - innerWidth, outerHeight - innerHeight])', returnByValue: true },
        sessionId,
      );
      const [dx, dy] = JSON.parse(d.result?.value ?? '[]') as number[];
      if (typeof dx === 'number' && dx >= 0 && dx < 200) this.chromeDx = dx;
      if (typeof dy === 'number' && dy > 0 && dy < 400) this.chromeDy = dy;
    } catch { /* keep defaults */ }
    await this.applyViewportAndScreencast();

    let url = '';
    try {
      const r = await this.client.send<{ result?: { value?: string } }>(
        'Runtime.evaluate', { expression: 'location.href', returnByValue: true }, sessionId,
      );
      url = r.result?.value ?? '';
    } catch { /* ignore */ }

    if (targetId === this.primaryTargetId) {
      // Primary app tab: park off-screen, or pop on-screen if it's mid cross-origin SSO.
      const curOrigin = safeOrigin(url);
      if (curOrigin && curOrigin !== this.appOrigin) this.enterLogin(url);
      else this.scheduleHideIfStable();
    } else {
      // A new tab/popup the user opened (link or OAuth popup): show it so they can interact.
      this.status = 'connected';
      this.post({ type: 'chromeStatus', status: 'connected', url });
      this.moveOnScreen();
    }
  }

  /** The active tab closed → fall back to the primary (or any) remaining page target. */
  private async fallbackToAnyPage(): Promise<void> {
    if (!this.client) return;
    this.activeSession = undefined;
    this.activeTargetId = undefined;
    try {
      const { targetInfos } = await this.client.send<{ targetInfos: Array<{ targetId: string; type: string }> }>('Target.getTargets');
      const page =
        targetInfos.find((t) => t.targetId === this.primaryTargetId && t.type === 'page') ??
        targetInfos.find((t) => t.type === 'page');
      if (!page) return;
      const { sessionId } = await this.client.send<{ sessionId: string }>('Target.attachToTarget', { targetId: page.targetId, flatten: true });
      await this.switchActive(sessionId, page.targetId);
    } catch { /* ignore */ }
  }

  /** Size the window so its content area equals the rendered size, positioned off- or on-screen. */
  private applyWindowBounds(): void {
    if (!this.client || this.windowId == null) return;
    const width = Math.round(this.renderW + this.chromeDx);
    const height = Math.round(this.renderH + this.chromeDy);
    const left = this.offscreen ? -5000 : 80;
    const top = this.offscreen ? 0 : 80;
    this.client
      .send('Browser.setWindowBounds', { windowId: this.windowId, bounds: { left, top, width, height, windowState: 'normal' } })
      .catch(() => undefined);
  }

  /** Park the browser window off-screen: it keeps compositing (frames flow) but stays out of the way. */
  private moveOffScreen(): void {
    clearTimeout(this.offscreenTimer);
    if (this.windowId == null || this.offscreen) return;
    this.offscreen = true;
    this.applyWindowBounds();
  }

  /** Bring the browser window on-screen and focus it (for native login). */
  private moveOnScreen(): void {
    clearTimeout(this.offscreenTimer);
    this.offscreen = false;
    this.applyWindowBounds();
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
    const { width: panelW, height: panelH, dpr } = this.viewport;

    // The off-screen window's content area can't exceed its display, so the screencast can't be
    // taller/wider than the screen. Cap the rendered size to fit the display (minus chrome),
    // preserving the panel aspect ratio. The webview then upscales the frame to fill the panel —
    // no letterbox bars, no distortion (just slightly softer when downscaled).
    let availW = 100000, availH = 100000;
    try {
      const a = await this.client.send<{ result?: { value?: string } }>(
        'Runtime.evaluate',
        { expression: 'JSON.stringify([screen.availWidth, screen.availHeight])', returnByValue: true },
        this.sessionId,
      );
      const [aw, ah] = JSON.parse(a.result?.value ?? '[]') as number[];
      if (aw > 0) availW = aw;
      if (ah > 0) availH = ah;
    } catch { /* assume unconstrained */ }
    const maxW = Math.max(200, availW - this.chromeDx - 8);
    const maxH = Math.max(200, availH - this.chromeDy - 8);
    const f = Math.min(1, maxW / panelW, maxH / panelH);
    this.renderW = Math.max(1, Math.round(panelW * f));
    this.renderH = Math.max(1, Math.round(panelH * f));

    // Size the window so its content == the (capped) rendered size, then render + screencast at it.
    this.applyWindowBounds();
    try {
      await this.client.send(
        'Emulation.setDeviceMetricsOverride',
        { width: this.renderW, height: this.renderH, deviceScaleFactor: dpr, mobile: false },
        this.sessionId,
      );
      if (this.screencasting) {
        await this.client.send('Page.stopScreencast', {}, this.sessionId).catch(() => undefined);
      }
      await this.client.send(
        'Page.startScreencast',
        { format: 'png', maxWidth: Math.round(this.renderW * dpr), maxHeight: Math.round(this.renderH * dpr), everyNthFrame: 1 },
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

  /** Page → host: the companion called window.__cmHostBinding(payload). Relay as cmFromPage. */
  private onBindingCalled(params: BindingCalledParams): void {
    if (params.name !== '__cmHostBinding') return;
    try {
      const payload = JSON.parse(params.payload);
      this.post({ type: 'cmFromPage', payload });
    } catch {
      /* ignore malformed payload */
    }
  }

  /** Browser navigation controls for the active tab (so the user never gets stranded). */
  async browserNav(action: 'back' | 'forward' | 'reload'): Promise<void> {
    if (!this.client || !this.sessionId) return;
    const s = this.sessionId;
    if (action === 'reload') {
      this.client.send('Page.reload', {}, s).catch(() => undefined);
      return;
    }
    try {
      const hist = await this.client.send<{ currentIndex: number; entries: Array<{ id: number }> }>(
        'Page.getNavigationHistory', {}, s,
      );
      const idx = action === 'back' ? hist.currentIndex - 1 : hist.currentIndex + 1;
      if (idx >= 0 && idx < hist.entries.length) {
        await this.client.send('Page.navigateToHistoryEntry', { entryId: hist.entries[idx].id }, s);
      } else if (action === 'back' && this.activeTargetId && this.activeTargetId !== this.primaryTargetId) {
        // No back history on a secondary tab/popup (e.g. a target=_blank link) → close it and
        // fall back to the primary app tab so the user returns to where they were.
        await this.client.send('Target.closeTarget', { targetId: this.activeTargetId }).catch(() => undefined);
      }
    } catch (err) {
      this.log?.appendLine(`[cdp] browserNav ${action} failed: ${(err as Error).message}`);
    }
  }

  /** Navigate the active tab to a path on the app origin (focusing a comment on another page). */
  navigateToPath(path: string): void {
    if (!this.client || !this.sessionId || !this.appOrigin) return;
    const url = this.appOrigin + (path || '/');
    this.client.send('Page.navigate', { url }, this.sessionId).catch(() => undefined);
  }

  /** Host → page: deliver a cm-* message to the companion via window.__cmDeliver. */
  sendToPage(payload: CmHostToPage): void {
    if (!this.client || !this.sessionId) return;
    const expr = `window.__cmDeliver && window.__cmDeliver(${JSON.stringify(payload)})`;
    this.client.send('Runtime.evaluate', { expression: expr }, this.sessionId).catch(() => undefined);
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

    // Login pop-out / off-screen parking applies only to the primary app tab. Secondary tabs
    // (links, OAuth popups) are shown on-screen and just keep screencasting.
    if (this.activeTargetId !== this.primaryTargetId) {
      void this.applyViewportAndScreencast();
      return;
    }

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

interface BindingCalledParams {
  name: string;
  payload: string;
}

interface AttachedToTargetParams {
  sessionId: string;
  targetInfo?: { targetId: string; type: string; url: string };
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
