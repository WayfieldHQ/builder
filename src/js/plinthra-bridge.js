/*
 * Plinthra ⇄ Builder bridge client (classic script, loaded before the app).
 *
 * Lets the Builder run Plinthra's Pro Celestials (Cloudflare Workers AI, metered
 * in Photons) in addition to the free Puter models, and select which Celestial
 * to use.
 *
 * Exposes:
 *   window.PLINTHRA_BRIDGE.connect()          open the connect popup
 *   window.PLINTHRA_BRIDGE.enabled()          true once a token is stored
 *   window.PLINTHRA_BRIDGE.chat(msgs, opts)   streaming async-iterable of chunks
 *   window.aiChat(msgs, opts)                 transport switch used by the app
 */
(function () {
  'use strict';

  var BRIDGE_URL = window.PLINTHRA_BRIDGE_URL || 'https://plinthra.com/api/builder/chat';
  var CONNECT_URL = window.PLINTHRA_CONNECT_URL || 'https://plinthra.com/builder/connect';
  var KEY = 'plinthra_bridge_token';
  var token = null;
  try { token = localStorage.getItem(KEY); } catch (e) { /* private mode */ }

  function enabled() { return !!token; }
  function celestial() {
    return (window.PLINTHRA && window.PLINTHRA.current && window.PLINTHRA.current()) || 'lyra';
  }
  function celestialObj(key) {
    return (window.PLINTHRA && window.PLINTHRA.get && window.PLINTHRA.get(key || celestial())) || null;
  }

  function setToken(t) {
    token = t || null;
    try { if (token) localStorage.setItem(KEY, token); else localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    updateUI();
    window.dispatchEvent(new CustomEvent('plinthra-bridge-changed', { detail: { enabled: enabled() } }));
  }

  function connect() {
    window.open(CONNECT_URL, 'plinthra_connect', 'width=460,height=560,menubar=no,toolbar=no');
  }

  window.addEventListener('message', function (e) {
    if (e && e.data && e.data.type === 'plinthra_builder_token' && e.data.token) setToken(e.data.token);
  });

  async function chat(messages, opts) {
    opts = opts || {};
    var key = opts.celestial || celestial();
    var res = await fetch(BRIDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ messages: messages, tools: opts.tools || window.tools || [], celestial: key }),
      signal: opts.signal,
    });
    if (!res.ok) {
      var body = await res.text().catch(function () { return ''; });
      var msg = 'Plinthra bridge error (' + res.status + ')';
      try { var j = JSON.parse(body); if (j && j.message) msg += ': ' + j.message; } catch (e) {}
      throw new Error(msg);
    }
    var reader = res.body.getReader();
    var dec = new TextDecoder();
    var buf = '';
    return (async function* () {
      while (true) {
        var r = await reader.read();
        if (r.done) break;
        buf += dec.decode(r.value, { stream: true });
        var nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          var line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (!line.trim()) continue;
          try { yield JSON.parse(line); } catch (e) { /* skip malformed */ }
        }
      }
    })();
  }

  // ---- Minimal control: Celestial picker + connect toggle --------------------
  function updateUI() {
    var btn = document.getElementById('plinthra-bridge-btn');
    var sel = document.getElementById('plinthra-celestial');
    if (btn) {
      btn.textContent = enabled() ? 'Plinthra ✓' : 'Connect';
      btn.style.borderColor = enabled() ? 'rgba(255,122,51,0.6)' : 'rgba(255,255,255,0.14)';
      btn.style.color = enabled() ? '#ff9a5c' : '#9aa4b2';
    }
    if (sel && window.PLINTHRA) {
      var cur = celestial();
      if (sel.value !== cur) sel.value = cur;
    }
  }
  function injectUI() {
    if (document.getElementById('plinthra-bridge-ui')) return;
    var wrap = document.createElement('div');
    wrap.id = 'plinthra-bridge-ui';
    wrap.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:2147483000;display:flex;align-items:center;gap:6px;padding:5px 6px 5px 10px;border-radius:999px;border:1px solid rgba(255,255,255,0.14);background:rgba(10,14,22,0.86);backdrop-filter:blur(8px);font:600 12px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif';
    var status = document.createElement('span');
    status.id = 'plinthra-bridge-status';
    status.style.cssText = 'font:500 11px/1.2 inherit;color:#fca5a5;display:none;max-width:190px';
    var sel = document.createElement('select');
    sel.id = 'plinthra-celestial';
    sel.title = 'Celestial (free models run via Puter; Pro run via Plinthra, metered in Photons)';
    sel.style.cssText = 'background:transparent;border:0;color:#cbd5e1;font:600 12px/1 inherit;outline:none;cursor:pointer';
    var list = (window.PLINTHRA && window.PLINTHRA.list && window.PLINTHRA.list()) || [];
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      var o = document.createElement('option');
      o.value = c.key;
      var underlying = c.puter ? c.puter.split('/').pop().replace(':free', '') : '';
      var tierLabel = c.tier === 'free' ? 'free' : (c.tier === 'starter' ? 'Starter' : 'Pro');
      o.textContent = c.symbol + ' ' + c.name + ' · ' + tierLabel + (underlying ? ' · ' + underlying : '');
      o.style.color = '#0b1220';
      sel.appendChild(o);
    }
    sel.value = celestial();
    sel.addEventListener('change', function () {
      if (window.PLINTHRA && window.PLINTHRA.set) window.PLINTHRA.set(sel.value);
      var obj = celestialObj(sel.value);
      if (obj && obj.tier !== 'free' && !enabled()) connect();
      updateUI();
    });
    var btn = document.createElement('button');
    btn.id = 'plinthra-bridge-btn';
    btn.type = 'button';
    btn.title = 'Connect Plinthra to run Pro Celestials (Horizon, Singularity, Andromeda) metered in Photons';
    btn.style.cssText = 'padding:5px 11px;border-radius:999px;border:1px solid rgba(255,255,255,0.14);background:transparent;font:600 12px/1 inherit;cursor:pointer';
    btn.addEventListener('click', function () { if (enabled()) setToken(null); else connect(); });
    wrap.appendChild(status);
    wrap.appendChild(sel);
    wrap.appendChild(btn);
    document.body.appendChild(wrap);

    window.addEventListener('plinthra-bridge-fallback', function (ev) {
      var s = document.getElementById('plinthra-bridge-status');
      if (!s) return;
      s.style.display = 'inline';
      s.textContent = 'Plinthra unavailable — using Puter';
      s.title = (ev && ev.detail && ev.detail.error) || '';
      clearTimeout(window.__plinthraBridgeStatusTimer);
      window.__plinthraBridgeStatusTimer = setTimeout(function () { s.style.display = 'none'; }, 7000);
    });

    updateUI();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectUI);
  else injectUI();

  window.PLINTHRA_BRIDGE = { enabled: enabled, setToken: setToken, connect: connect, chat: chat, getToken: function () { return token; } };

  // Transport switch: Pro Celestials go through Plinthra when connected;
  // everything else (free Celestials, or Pro with no connection) runs on the
  // free Puter model for the selected Celestial.
  window.aiChat = async function (messages, opts) {
    opts = opts || {};
    var key = celestial();
    var cel = celestialObj(key);
    var isPro = cel && cel.tier !== 'free';

    // Pro Celestials go through Plinthra when connected. If the bridge is
    // down, the token expired, or the Photon quota is exhausted, fall back to
    // the Celestial's free Puter model instead of leaving the Builder stuck.
    if (enabled() && isPro) {
      try {
        return await window.PLINTHRA_BRIDGE.chat(messages, Object.assign({}, opts, { celestial: key }));
      } catch (e) {
        var msg = e && e.message ? e.message : String(e);
        console.warn('[plinthra] bridge unavailable, using Puter fallback:', msg);
        window.__plinthraBridgeError = msg;
        window.dispatchEvent(new CustomEvent('plinthra-bridge-fallback', { detail: { error: msg, celestial: key } }));
      }
    }

    // Free path — use the selected Celestial's free Puter model.
    if (window.PLINTHRA && window.PLINTHRA.resolveModel) opts.model = window.PLINTHRA.resolveModel(key);
    return puter.ai.chat(messages, opts);
  };
})();
