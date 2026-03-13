import * as http from 'http';
import * as net from 'net';
import type { OutputChannel } from 'vscode';

const COMPANION_SCRIPT = `<script>
(function(){
  var _cmActive = false;
  var _cmHighlighted = null;
  var _cmPrevOutline = '';
  var _cmMarkers = [];

  function clearMarkers() {
    for (var i = 0; i < _cmMarkers.length; i++) {
      var m = _cmMarkers[i];
      if (m.badge.parentNode) m.badge.parentNode.removeChild(m.badge);
      if (m.wasStatic) m.el.style.position = m.prevPos;
    }
    _cmMarkers = [];
  }

  function renderMarkers(comments) {
    clearMarkers();
    var groups = {};
    for (var i = 0; i < comments.length; i++) {
      var c = comments[i];
      if (c.status === 'resolved') continue;
      var key = (c.elementId || '') + '|' + (c.testId || '') + '|' + (c.tag || '') + '|' + (c.text || '').slice(0, 20);
      if (!groups[key]) groups[key] = { anchor: c, count: 0 };
      groups[key].count++;
    }
    for (var k in groups) {
      var g = groups[k];
      var a = g.anchor;
      var found = null;
      if (a.elementId) found = document.getElementById(a.elementId);
      if (!found && a.testId) found = document.querySelector('[data-testid="' + a.testId + '"]');
      if (!found && a.tag && a.text) {
        var els = document.querySelectorAll(a.tag);
        for (var j = 0; j < els.length; j++) {
          if ((els[j].textContent || '').trim().indexOf(a.text) !== -1) { found = els[j]; break; }
        }
      }
      if (!found && a.cssPath) { try { found = document.querySelector(a.cssPath); } catch(e) {} }
      if (!found || found === document.body || found === document.documentElement) continue;
      var badge = document.createElement('span');
      badge.setAttribute('data-cm-badge', '1');
      badge.style.cssText = 'position:absolute;top:-6px;right:-6px;min-width:14px;height:14px;background:#FF6F00;color:#fff;border-radius:7px;font-size:9px;font-weight:bold;display:inline-flex;align-items:center;justify-content:center;z-index:99999;pointer-events:none;line-height:1;padding:0 2px;box-shadow:0 1px 3px rgba(0,0,0,0.5);';
      badge.textContent = g.count > 9 ? '9+' : String(g.count);
      var prevPos = found.style.position;
      var computedPos = window.getComputedStyle(found).position;
      if (computedPos === 'static') found.style.position = 'relative';
      found.appendChild(badge);
      _cmMarkers.push({ el: found, badge: badge, prevPos: prevPos, wasStatic: computedPos === 'static' });
    }
  }

  function getCssPath(el) {
    var path = [];
    var current = el;
    while (current && current !== document.body && current !== document.documentElement) {
      var tag = current.tagName.toLowerCase();
      var parent = current.parentElement;
      if (parent) {
        var siblings = parent.querySelectorAll(':scope > ' + tag);
        if (siblings.length > 1) {
          var idx = Array.prototype.indexOf.call(siblings, current) + 1;
          tag += ':nth-of-type(' + idx + ')';
        }
      }
      path.unshift(tag);
      current = current.parentElement;
    }
    return path.join(' > ');
  }

  function buildLabel(el) {
    var tag = el.tagName.toLowerCase();
    var text = (el.textContent || '').trim().replace(/\\s+/g,' ').slice(0, 40);
    var id = el.id ? '#' + el.id : '';
    var testId = (el.dataset && el.dataset.testid) ? '[testid=' + el.dataset.testid + ']' : '';
    var ref = id || testId || '';
    if (text && ref) return text + ' \u00b7 ' + ref;
    if (text) return text + ' \u00b7 <' + tag + '>';
    if (ref) return '<' + tag + '> \u00b7 ' + ref;
    return '<' + tag + '>';
  }

  function clearHighlight() {
    if (_cmHighlighted) {
      _cmHighlighted.style.outline = _cmPrevOutline;
      _cmHighlighted = null;
    }
  }

  function enterCommentMode() {
    _cmActive = true;
    document.body.style.cursor = 'crosshair';
  }

  function exitCommentMode() {
    _cmActive = false;
    document.body.style.cursor = '';
    clearHighlight();
  }

  document.addEventListener('mousemove', function(e) {
    if (!_cmActive) return;
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === _cmHighlighted || el === document.body || el === document.documentElement) return;
    clearHighlight();
    _cmHighlighted = el;
    _cmPrevOutline = el.style.outline || '';
    el.style.outline = '2px solid #FF6F00';
    el.style.outlineOffset = '1px';
  }, true);

  document.addEventListener('mouseleave', function() {
    if (!_cmActive) return;
    clearHighlight();
  }, true);

  document.addEventListener('click', function(e) {
    if (!_cmActive) return;
    e.preventDefault();
    e.stopPropagation();
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el) return;
    var label = buildLabel(el);
    window.parent.postMessage({
      type: 'cm-element-selected',
      label: label,
      tag: el.tagName.toLowerCase(),
      elementId: el.id || undefined,
      testId: (el.dataset && el.dataset.testid) || undefined,
      text: (el.textContent || '').trim().replace(/\\s+/g,' ').slice(0, 40) || undefined,
      cssPath: getCssPath(el),
      pathname: window.location.pathname + window.location.search + window.location.hash,
    }, '*');
  }, true);

  window.addEventListener('message', function(e) {
    if (!e.data) return;

    if (e.data.type === 'cm-comment-mode') {
      if (e.data.active) enterCommentMode();
      else exitCommentMode();
      return;
    }

    if (e.data.type === 'cm-highlight-element') {
      var hlData = e.data;
      function findEl() {
        var f = null;
        if (hlData.elementId) f = document.getElementById(hlData.elementId);
        if (!f && hlData.testId) f = document.querySelector('[data-testid="' + hlData.testId + '"]');
        if (!f && hlData.tag && hlData.text) {
          var els = document.querySelectorAll(hlData.tag);
          for (var i = 0; i < els.length; i++) {
            if ((els[i].textContent || '').trim().indexOf(hlData.text) !== -1) { f = els[i]; break; }
          }
        }
        if (!f && hlData.cssPath) { try { f = document.querySelector(hlData.cssPath); } catch(e) {} }
        return f;
      }
      function tryHighlight(attemptsLeft) {
        var found = findEl();
        if (found) {
          found.scrollIntoView({ behavior: 'smooth', block: 'center' });
          var prev = found.style.outline;
          var prevShadow = found.style.boxShadow;
          found.style.outline = '2px solid #FF6F00';
          found.style.boxShadow = '0 0 0 4px rgba(255,111,0,0.25)';
          setTimeout(function() {
            found.style.outline = prev;
            found.style.boxShadow = prevShadow;
          }, 2000);
        } else if (attemptsLeft > 0) {
          setTimeout(function() { tryHighlight(attemptsLeft - 1); }, 300);
        }
      }
      tryHighlight(6); // retry up to 6×300ms = 1.8s to allow SPA to render
      return;
    }

    if (e.data.type === 'cm-update-markers') {
      renderMarkers(e.data.comments || []);
      return;
    }

    if (e.data.type === 'cm-identify') {
      var el = document.elementFromPoint(e.data.x, e.data.y);
      if (!el) return;
      window.parent.postMessage({
        type: 'cm-element-info', nonce: e.data.nonce,
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || '').trim().slice(0, 80) || undefined,
        id: el.id || undefined,
        testId: (el.dataset && el.dataset.testid) || undefined,
        pathname: window.location.pathname,
        scrollY: window.scrollY,
        documentHeight: document.documentElement.scrollHeight,
      }, '*');
      return;
    }
  });

  function notifyNav() {
    window.parent.postMessage({
      type: 'cm-navigate',
      pathname: window.location.pathname + window.location.search + window.location.hash,
    }, '*');
  }

  var _push = history.pushState.bind(history);
  history.pushState = function() { _push.apply(history, arguments); notifyNav(); };
  var _replace = history.replaceState.bind(history);
  history.replaceState = function() { _replace.apply(history, arguments); notifyNav(); };
  window.addEventListener('popstate', notifyNav);
  window.addEventListener('hashchange', notifyNav);

  notifyNav();
})();
</script>`;

/** Headers from the upstream server that must be removed to allow the proxy to work correctly. */
const BLOCKED_HEADERS = new Set([
  'content-security-policy',
  'content-security-policy-report-only',
  'x-frame-options',
  'x-content-type-options',
  'content-length',
  'transfer-encoding',
]);

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

    const options: http.RequestOptions = {
      hostname: target.hostname,
      port: Number(target.port) || (target.protocol === 'https:' ? 443 : 80),
      path: req.url ?? '/',
      method: req.method,
      headers: {
        ...req.headers,
        host: target.host,
        'accept-encoding': 'identity',
      },
    };

    const proxyReq = http.request(options, (proxyRes) => {
      this.log?.appendLine(`[proxy] ${proxyRes.statusCode} ${req.url ?? '/'}`);
      const contentType = proxyRes.headers['content-type'] ?? '';
      const isHtml = contentType.includes('text/html');

      const outHeaders: http.OutgoingHttpHeaders = {};
      for (const [k, v] of Object.entries(proxyRes.headers)) {
        if (!BLOCKED_HEADERS.has(k.toLowerCase())) outHeaders[k] = v;
      }

      if (isHtml) {
        const chunks: Buffer[] = [];
        proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk));
        proxyRes.on('end', () => {
          let body = Buffer.concat(chunks).toString('utf8');
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
</div><script>setTimeout(function(){location.reload();},2000);</script></body></html>`;
      const buf = Buffer.from(errorHtml, 'utf8');
      res.writeHead(502, { 'content-type': 'text/html; charset=utf-8', 'content-length': buf.byteLength });
      res.end(buf);
    });

    req.pipe(proxyReq, { end: true });
  }

  private handleUpgrade(req: http.IncomingMessage, socket: net.Socket, head: Buffer): void {
    const target = this.target;
    const port = Number(target.port) || 80;
    const upstream = net.connect(port, target.hostname, () => {
      const reqLine = `${req.method ?? 'GET'} ${req.url ?? '/'} HTTP/1.1\r\n`;
      const headers = Object.entries(req.headers)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
        .join('\r\n');
      upstream.write(reqLine + headers + '\r\n\r\n');
      if (head.length) upstream.write(head);
      upstream.pipe(socket, { end: true });
      socket.pipe(upstream, { end: true });
    });
    upstream.on('error', () => socket.destroy());
    socket.on('error', () => upstream.destroy());
  }
}
