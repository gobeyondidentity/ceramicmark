import * as http from 'http';
import * as net from 'net';
import type { OutputChannel } from 'vscode';

const COMPANION_SCRIPT = `<script>
(function(){
  var _cmActive = false;
  var _cmHighlighted = null;
  var _cmPrevOutline = '';
  var _cmMarkers = [];
  var _cmLastComments = [];
  var _cmRendering = false;
  // Persistent focus highlight state
  var _cmFocusedHighlight = null;
  var _cmFocusedEl = null;
  var _cmFocusedPrevOutline = '';
  var _cmFocusedPrevShadow = '';
  var _cmFocusedPrevZ = '';
  var _cmFocusedPrevPos = '';
  var _cmFocusedWasStatic = false;

  function clearMarkers() {
    for (var i = 0; i < _cmMarkers.length; i++) {
      var m = _cmMarkers[i];
      if (m.badge.parentNode) m.badge.parentNode.removeChild(m.badge);
      if (m.wasStatic) m.el.style.position = m.prevPos;
    }
    _cmMarkers = [];
  }

  function renderMarkers(comments) {
    _cmRendering = true;
    _cmLastComments = comments;
    clearMarkers();
    var groups = {};
    for (var i = 0; i < comments.length; i++) {
      var c = comments[i];
      if (c.status === 'resolved') continue;
      var key = (c.elementId || '') + '|' + (c.testId || '') + '|' + (c.tag || '') + '|' + (c.text || '').slice(0, 20);
      if (!groups[key]) groups[key] = { anchor: c, firstId: c.id, count: 0 };
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
      if (!found || found === document.body || found === document.documentElement) {
        continue;
      }
      var badge = document.createElement('span');
      badge.setAttribute('data-cm-badge', '1');
      badge.setAttribute('data-cm-comment-id', g.firstId);
      badge.style.cssText = 'position:absolute;top:-8px;right:-8px;width:18px;height:18px;background:#FF6F00;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;z-index:99999;pointer-events:auto;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,0.5);';
      badge.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="#fff" viewBox="0 0 16 16"><path d="M8 15c4.418 0 8-3.134 8-7s-3.582-7-8-7-8 3.134-8 7c0 1.76.743 3.37 1.97 4.6-.097 1.016-.417 2.13-.771 2.966-.079.186.074.394.273.362 2.256-.37 3.597-.938 4.18-1.234A9.06 9.06 0 0 0 8 15z"/></svg>';
      var prevPos = found.style.position;
      var computedPos = window.getComputedStyle(found).position;
      if (computedPos === 'static') found.style.position = 'relative';
      found.appendChild(badge);
      _cmMarkers.push({ el: found, badge: badge, prevPos: prevPos, wasStatic: computedPos === 'static' });
    }
    _cmRendering = false;
  }

  // Re-apply markers when the DOM changes (e.g. React re-renders tabs/views without a URL change)
  var _cmMutationTimer = null;
  var _cmObserver = new MutationObserver(function(mutations) {
    if (_cmRendering) return;
    if (_cmLastComments.length === 0) return;
    // Ignore mutations caused solely by our own badge insertions/removals
    for (var i = 0; i < mutations.length; i++) {
      var nodes = mutations[i].addedNodes;
      for (var j = 0; j < nodes.length; j++) {
        if (nodes[j].nodeType === 1 && nodes[j].getAttribute && nodes[j].getAttribute('data-cm-badge')) return;
      }
    }
    clearTimeout(_cmMutationTimer);
    _cmMutationTimer = setTimeout(function() {
      renderMarkers(_cmLastComments);
      if (_cmFocusedHighlight) tryFocusHighlight(1);
    }, 300);
  });
  if (document.body) {
    _cmObserver.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      _cmObserver.observe(document.body, { childList: true, subtree: true });
    });
  }

  function clearFocusHighlight() {
    if (!_cmFocusedEl) return;
    _cmFocusedEl.style.outline = _cmFocusedPrevOutline;
    _cmFocusedEl.style.boxShadow = _cmFocusedPrevShadow;
    _cmFocusedEl.style.zIndex = _cmFocusedPrevZ;
    if (_cmFocusedWasStatic) _cmFocusedEl.style.position = _cmFocusedPrevPos;
    _cmFocusedEl = null;
  }

  function findFocusedEl() {
    var d = _cmFocusedHighlight;
    if (!d) return null;
    var f = null;
    if (d.elementId) f = document.getElementById(d.elementId);
    if (!f && d.testId) f = document.querySelector('[data-testid="' + d.testId + '"]');
    if (!f && d.tag && d.text) {
      var els = document.querySelectorAll(d.tag);
      for (var i = 0; i < els.length; i++) {
        if ((els[i].textContent || '').trim().indexOf(d.text) !== -1) { f = els[i]; break; }
      }
    }
    if (!f && d.cssPath) { try { f = document.querySelector(d.cssPath); } catch(ex) {} }
    return f;
  }

  function applyFocusHighlight(el) {
    clearFocusHighlight();
    _cmFocusedEl = el;
    _cmFocusedPrevOutline = el.style.outline;
    _cmFocusedPrevShadow = el.style.boxShadow;
    _cmFocusedPrevZ = el.style.zIndex;
    _cmFocusedPrevPos = el.style.position;
    var computedPos = window.getComputedStyle(el).position;
    _cmFocusedWasStatic = computedPos === 'static';
    if (_cmFocusedWasStatic) el.style.position = 'relative';
    el.style.zIndex = '99999';
    el.style.boxShadow = '0 0 0 4px rgba(255,111,0,0.25)';
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // JS-driven outline pulse — reliable across VS Code webview iframe environments
    var flashEl = el;
    var pulseSteps = ['4px solid #FF6F00', '2px solid rgba(255,111,0,0.25)', '4px solid #FF6F00', '2px solid #FF6F00'];
    function doPulse(i) {
      if (_cmFocusedEl !== flashEl) return;
      flashEl.style.outline = pulseSteps[i];
      if (i < pulseSteps.length - 1) setTimeout(function() { doPulse(i + 1); }, 160);
    }
    doPulse(0);
  }

  function tryFocusHighlight(attemptsLeft) {
    var found = findFocusedEl();
    if (found) {
      applyFocusHighlight(found);
    } else if (attemptsLeft > 0) {
      setTimeout(function() { tryFocusHighlight(attemptsLeft - 1); }, 300);
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
    // 1. aria-label
    var ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim() + ' \u00b7 <' + tag + '>';
    // 2. placeholder (form fields)
    if ((tag === 'input' || tag === 'textarea' || tag === 'select') && el.placeholder)
      return el.placeholder + ' \u00b7 <' + tag + '>';
    // 3. alt (images)
    if (tag === 'img' && el.alt) return el.alt + ' \u00b7 <img>';
    // 4. title attribute
    var titleAttr = el.getAttribute('title');
    if (titleAttr && titleAttr.trim()) return titleAttr.trim() + ' \u00b7 <' + tag + '>';
    // 5. id / testId refs
    var id = el.id ? '#' + el.id : '';
    var testId = (el.dataset && el.dataset.testid) ? '[testid=' + el.dataset.testid + ']' : '';
    var ref = id || testId || '';
    // 6. direct textContent
    var text = (el.textContent || '').trim().replace(/\\s+/g,' ').slice(0, 40);
    if (text && ref) return text + ' \u00b7 ' + ref;
    if (text) return text + ' \u00b7 <' + tag + '>';
    if (ref) return '<' + tag + '> \u00b7 ' + ref;
    // 7. meaningful child element (heading, button, labelled element, etc.)
    var child = el.querySelector('h1,h2,h3,h4,h5,h6,button,[aria-label],[placeholder],img[alt],label');
    if (child) {
      var childLabel = child.getAttribute('aria-label') ||
        child.getAttribute('placeholder') ||
        child.getAttribute('alt') ||
        (child.textContent || '').trim().replace(/\\s+/g,' ').slice(0, 40);
      if (childLabel) return childLabel + ' \u00b7 <' + tag + '>';
    }
    // 8. role hint
    var role = el.getAttribute('role');
    if (role) return '<' + tag + '[' + role + ']>';
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
    // Badge click — open comment in sidebar regardless of comment mode
    var target = e.target;
    var badgeEl = (target && target.closest) ? target.closest('[data-cm-badge]') : null;
    if (!badgeEl && target && target.hasAttribute && target.hasAttribute('data-cm-badge')) badgeEl = target;
    if (badgeEl) {
      e.preventDefault();
      e.stopPropagation();
      var commentId = badgeEl.getAttribute('data-cm-comment-id');
      if (commentId) window.parent.postMessage({ type: 'cm-marker-clicked', commentId: commentId }, '*');
      return;
    }
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
      title: document.title,
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
      _cmFocusedHighlight = e.data;
      tryFocusHighlight(6);
      return;
    }

    if (e.data.type === 'cm-clear-highlight') {
      _cmFocusedHighlight = null;
      clearFocusHighlight();
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
      title: document.title,
    }, '*');
  }

  // For SPA client-side navigation: defer 100ms so the framework has rendered new content.
  // requestAnimationFrame is avoided because it can be throttled in VS Code webview iframes.
  function notifyNavDeferred() {
    setTimeout(notifyNav, 100);
  }

  var _push = history.pushState.bind(history);
  history.pushState = function() { _push.apply(history, arguments); notifyNavDeferred(); };
  var _replace = history.replaceState.bind(history);
  history.replaceState = function() { _replace.apply(history, arguments); notifyNavDeferred(); };
  window.addEventListener('popstate', notifyNavDeferred);
  window.addEventListener('hashchange', notifyNavDeferred);

  // Poll document.title every 500ms — for React-state apps where the URL never changes
  // but the title updates when the user switches sections/views.
  var _cmLastTitle = document.title;
  setInterval(function() {
    var t = document.title;
    if (t !== _cmLastTitle) {
      _cmLastTitle = t;
      notifyNavDeferred();
    }
  }, 500);

  // For initial MPA page load: wait until DOMContentLoaded so body elements exist
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', notifyNav);
  } else {
    notifyNav();
  }
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
          // Rewrite absolute target-origin URLs in HTML attributes to relative paths
          // so that iframe navigation stays within the proxy rather than bypassing it.
          // e.g. href="http://localhost:5173/about" → href="/about"
          const targetOrigin = target.protocol + '//' + target.host;
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
