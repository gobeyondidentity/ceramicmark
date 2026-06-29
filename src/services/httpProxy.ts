import * as http from 'http';
import * as https from 'https';
import * as net from 'net';
import * as tls from 'tls';
import type { OutputChannel } from 'vscode';
import { getCompanionForProxy } from '../companion/companionScript.js';

const COMPANION_SCRIPT = getCompanionForProxy();

/** Headers from the upstream server that must be removed to allow the proxy to work correctly.
 *  NB: `set-cookie` is intentionally NOT blocked — it is forwarded (rewritten by `rewriteSetCookie`)
 *  so that login/session flows survive the proxy. */
const BLOCKED_HEADERS = new Set([
  'content-security-policy',
  'content-security-policy-report-only',
  'x-frame-options',
  'x-content-type-options',
  'content-length',
  'transfer-encoding',
]);

/**
 * Rebind upstream cookies to the proxy origin so sessions persist through the preview.
 * The proxy serves the app from `http://127.0.0.1:{port}`, which differs from the app's real
 * origin, and lives inside a cross-origin VS Code webview iframe. To keep cookies usable we:
 *   - drop `Domain=` so the cookie becomes host-only for 127.0.0.1,
 *   - force `SameSite=None` + `Secure` so the browser sends them in the third-party iframe context
 *     (127.0.0.1 counts as a secure context in Chromium even over http, so `Secure` is honored).
 */
function rewriteSetCookie(cookies: string[]): string[] {
  return cookies.map((cookie) => {
    const parts = cookie.split(';');
    const out = [parts[0].trim()]; // name=value
    for (let i = 1; i < parts.length; i++) {
      const attr = parts[i].trim();
      const lower = attr.toLowerCase();
      if (lower.startsWith('domain=')) continue;
      if (lower === 'secure') continue;
      if (lower.startsWith('samesite=')) continue;
      out.push(attr);
    }
    out.push('SameSite=None', 'Secure');
    return out.join('; ');
  });
}

export class HttpProxy {
  private readonly server: http.Server;
  private target: URL;
  readonly port: Promise<number>;

  constructor(targetUrl: string, private readonly log?: OutputChannel) {
    this.target = new URL(targetUrl);
    this.server = http.createServer(this.handleRequest.bind(this));
    this.server.on('upgrade', this.handleUpgrade.bind(this));

    this.port = new Promise<number>((resolve, reject) => {
      this.server.listen(0, '127.0.0.1', () => {
        const addr = this.server.address() as net.AddressInfo;
        resolve(addr.port);
      });
      this.server.once('error', reject);
    });
  }

  updateTarget(url: string): void {
    this.target = new URL(url);
  }

  stop(): void {
    this.server.close();
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const target = this.target;
    const targetHref = target.href;
    this.log?.appendLine(`[proxy] ${req.method ?? 'GET'} ${req.url ?? '/'} → ${targetHref}`);

    const isHttps = target.protocol === 'https:';
    const options: https.RequestOptions = {
      hostname: target.hostname,
      port: Number(target.port) || (isHttps ? 443 : 80),
      path: req.url ?? '/',
      method: req.method,
      headers: {
        ...req.headers,
        host: target.host,
        'accept-encoding': 'identity',
      },
    };
    // Dev IdPs and dev servers commonly use self-signed certs — don't reject them in a preview tool.
    if (isHttps) options.rejectUnauthorized = false;

    const requestFn = isHttps ? https.request : http.request;
    const proxyReq = requestFn(options, (proxyRes) => {
      this.log?.appendLine(`[proxy] ${proxyRes.statusCode} ${req.url ?? '/'}`);
      const contentType = proxyRes.headers['content-type'] ?? '';
      const isHtml = contentType.includes('text/html');

      const targetOrigin = target.protocol + '//' + target.host;

      const outHeaders: http.OutgoingHttpHeaders = {};
      for (const [k, v] of Object.entries(proxyRes.headers)) {
        if (!BLOCKED_HEADERS.has(k.toLowerCase())) outHeaders[k] = v;
      }

      // Rewrite redirects that point back at the target origin → relative, so the redirect
      // (e.g. login → /dashboard) stays inside the proxy instead of escaping to the real origin.
      if (typeof outHeaders['location'] === 'string') {
        const loc = outHeaders['location'];
        if (loc.startsWith(targetOrigin)) {
          outHeaders['location'] = loc.slice(targetOrigin.length) || '/';
        }
      }

      // Preserve session cookies, rebound to the proxy origin (see rewriteSetCookie).
      if (proxyRes.headers['set-cookie']) {
        outHeaders['set-cookie'] = rewriteSetCookie(proxyRes.headers['set-cookie']);
      }

      if (isHtml) {
        const chunks: Buffer[] = [];
        proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk));
        proxyRes.on('end', () => {
          let body = Buffer.concat(chunks).toString('utf8');
          // Rewrite absolute target-origin URLs in HTML attributes to relative paths
          // so that iframe navigation stays within the proxy rather than bypassing it.
          // e.g. href="http://localhost:5173/about" → href="/about"
          const escapedOrigin = targetOrigin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          body = body.replace(
            new RegExp('((?:href|src|action)=["\'])' + escapedOrigin, 'g'),
            '$1',
          );
          if (body.includes('</body>')) {
            body = body.replace('</body>', COMPANION_SCRIPT + '</body>');
          } else {
            body += COMPANION_SCRIPT;
          }
          const buf = Buffer.from(body, 'utf8');
          outHeaders['content-length'] = buf.byteLength;
          res.writeHead(proxyRes.statusCode ?? 200, outHeaders);
          res.end(buf);
        });
      } else {
        res.writeHead(proxyRes.statusCode ?? 200, outHeaders);
        proxyRes.pipe(res, { end: true });
      }
    });

    proxyReq.setTimeout(15000, () => {
      proxyReq.destroy();
      if (!res.headersSent) {
        res.writeHead(504, { 'content-type': 'text/plain' });
        res.end('Gateway Timeout');
      }
    });

    proxyReq.on('error', (err) => {
      this.log?.appendLine(`[proxy] ERROR ${req.url ?? '/'} — ${err.message}`);
      if (res.headersSent) { res.end(); return; }
      const errorHtml = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#1e1e1e;color:#ccc}
.box{text-align:center;padding:2rem}.title{font-size:1.5rem;color:#FF6F00;margin-bottom:.5rem}
.sub{font-size:.875rem;opacity:.7}.url{font-size:.75rem;margin-top:1rem;opacity:.5;font-family:monospace}
.dot{display:inline-block;animation:blink 1.2s infinite}.dot:nth-child(2){animation-delay:.4s}.dot:nth-child(3){animation-delay:.8s}
@keyframes blink{0%,80%,100%{opacity:0}40%{opacity:1}}</style>
</head><body><div class="box">
<div class="title">Waiting for dev server<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span></div>
<div class="sub">Will connect automatically when ready at:</div>
<div class="url">${targetHref}</div>
</div><script>window.parent.postMessage({type:'cm-connection-failed'},\'*\');setTimeout(function(){location.reload();},2000);</script></body></html>`;
      const buf = Buffer.from(errorHtml, 'utf8');
      res.writeHead(502, { 'content-type': 'text/html; charset=utf-8', 'content-length': buf.byteLength });
      res.end(buf);
    });

    req.pipe(proxyReq, { end: true });
  }

  private handleUpgrade(req: http.IncomingMessage, socket: net.Socket, head: Buffer): void {
    const target = this.target;
    const isHttps = target.protocol === 'https:';
    const port = Number(target.port) || (isHttps ? 443 : 80);
    const onConnect = (): void => {
      const reqLine = `${req.method ?? 'GET'} ${req.url ?? '/'} HTTP/1.1\r\n`;
      const headers = Object.entries({ ...req.headers, host: target.host })
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
        .join('\r\n');
      upstream.write(reqLine + headers + '\r\n\r\n');
      if (head.length) upstream.write(head);
      upstream.pipe(socket, { end: true });
      socket.pipe(upstream, { end: true });
    };
    const upstream: net.Socket = isHttps
      ? tls.connect({ host: target.hostname, port, servername: target.hostname, rejectUnauthorized: false }, onConnect)
      : net.connect(port, target.hostname, onConnect);
    upstream.on('error', () => socket.destroy());
    socket.on('error', () => upstream.destroy());
  }
}
