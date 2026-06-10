/*!
 * nas-shim.js · NiceAssOS estate-wide grafting shim
 * ◊·κ=φ⁴ · prime 1303
 *
 * Architecture: Thomas Frumkin · Implementation: Simon Gant
 *
 * Single-file drop-in shim that grafts every estate tool onto the NiceAssOS substrate:
 *   - detect fork.config.json (from niceassos-seed IndexedDB)
 *   - tag organ + layer via <meta> for the seed to discover
 *   - expose window.nas.{verdict, ingest, recall, broadcast, onEnvelope, badge}
 *   - render the fork badge (top-right pill)
 *   - auto-ingest form submits into FallMind v2 cube (when fork is present)
 *   - emit tool_visited mesh envelope (respects fork mesh_stance)
 *
 * Drop-in usage:
 *   <script src="https://sjgant80-hub.github.io/fall-euaiact/cdn/nas-shim.js"
 *           data-tool="gymops" data-organ="L3.organs.ops.fitness"></script>
 *
 * Behavior is identical to a no-op when no fork is present (ungrafted mode),
 * so this is safe to ripple across the entire estate.
 */
(function() {
  'use strict';

  // ====================================================================
  // CONFIG
  // ====================================================================

  var SCRIPT = document.currentScript || (function() {
    var s = document.querySelectorAll('script[src*="nas-shim"]');
    return s[s.length - 1];
  })();
  var DATA = SCRIPT ? SCRIPT.dataset : {};
  var TOOL_ID = DATA.tool || (location.pathname.split('/').filter(Boolean).pop() || 'unknown').replace(/\..+$/, '');
  var ORGAN   = DATA.organ || 'L3.organs.unspecified';
  var LAYER   = DATA.layer || ORGAN.split('.')[0];
  var DEBUG   = DATA.debug === 'true';
  var FALLMIND_URL = DATA.fallmind || 'http://localhost:1789';  // cube API
  var SEED_DB = 'niceassos-seed-v1';
  var MESH_DB = 'niceassos-mesh-v1';

  function log() { if (DEBUG) console.log.apply(console, ['[nas-shim]'].concat([].slice.call(arguments))); }

  // ====================================================================
  // ORGAN TAGS (idempotent)
  // ====================================================================

  function ensureMeta(name, content) {
    if (document.querySelector('meta[name="' + name + '"]')) return;
    var m = document.createElement('meta');
    m.name = name; m.content = content;
    document.head.appendChild(m);
  }
  ensureMeta('aios-organ', ORGAN);
  ensureMeta('aios-layer', LAYER);
  ensureMeta('aios-tool',  TOOL_ID);

  // ====================================================================
  // INDEXEDDB CROSS-DB READ
  // ====================================================================

  function openDB(name, version) {
    return new Promise(function(resolve, reject) {
      var req = indexedDB.open(name, version);
      req.onsuccess = function() { resolve(req.result); };
      req.onerror = function() { reject(req.error); };
      req.onblocked = function() { resolve(null); };
    });
  }

  function getFromStore(db, store, key) {
    return new Promise(function(resolve) {
      if (!db || !db.objectStoreNames.contains(store)) { resolve(null); return; }
      try {
        var tx = db.transaction(store, 'readonly');
        var r = tx.objectStore(store).get(key);
        r.onsuccess = function() { resolve(r.result); };
        r.onerror = function() { resolve(null); };
      } catch (_) { resolve(null); }
    });
  }

  // ====================================================================
  // FORK DETECTION
  // ====================================================================

  var FORK = null;  // populated async

  async function detectFork() {
    try {
      var seedDB = await openDB(SEED_DB);
      if (!seedDB) return null;
      var cfg = await getFromStore(seedDB, 'fork', 'config');
      var sealed = await getFromStore(seedDB, 'fork', 'sealed');
      seedDB.close();
      if (!cfg || !sealed) return null;
      log('fork detected', cfg.konomi_pub && cfg.konomi_pub.slice(0,12));
      return cfg;
    } catch (e) {
      log('fork detect failed', e.message);
      return null;
    }
  }

  // ====================================================================
  // CUBE INGEST (FallMind v2 :1789)
  // ====================================================================

  async function cubeIngest(text, meta) {
    if (!FORK || !text || typeof text !== 'string' || text.length < 2) return null;
    // FemtoLLM client-side encoding: deterministic 16-dim Float32 from ascii
    var vec = femtoEncode(text);
    var body = {
      text: text.slice(0, 4000),
      vec: vec,
      namespace: FORK.fallmind_namespace || ('fork-' + FORK.konomi_pub.slice(0,8)),
      meta: Object.assign({
        organ: ORGAN, tool: TOOL_ID,
        url: location.pathname,
        ts: new Date().toISOString(),
      }, meta || {}),
    };
    try {
      var r = await fetch(FALLMIND_URL + '/v2/ingest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
      });
      if (!r.ok) return null;
      return await r.json();
    } catch (e) {
      log('ingest skipped (cube offline)', e.message);
      return null;
    }
  }

  async function cubeRecall(query, k) {
    if (!FORK || !query) return [];
    var vec = femtoEncode(query);
    try {
      var r = await fetch(FALLMIND_URL + '/v2/query', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          vec: vec,
          namespace: FORK.fallmind_namespace || ('fork-' + FORK.konomi_pub.slice(0,8)),
          dim: 16,
          k: k || 5,
        }),
      });
      if (!r.ok) return [];
      var data = await r.json();
      return data.results || [];
    } catch (e) { return []; }
  }

  // mirror FemtoLLM ascii encoder (16-dim)
  function femtoEncode(text) {
    var HIDDEN = 16;
    var out = new Array(HIDDEN).fill(0);
    var s = String(text);
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i) & 0xff;
      out[i % HIDDEN] += (c / 128.0);
    }
    for (var j = 0; j < HIDDEN; j++) {
      out[j] = Math.tanh(out[j] / Math.max(1, s.length / HIDDEN));
    }
    return out;
  }

  // ====================================================================
  // MESH (BroadcastChannel)
  // ====================================================================

  var meshCh = null;
  var meshHandlers = [];
  try {
    meshCh = new BroadcastChannel('niceassos-mesh');
    meshCh.onmessage = function(e) {
      for (var i = 0; i < meshHandlers.length; i++) {
        try { meshHandlers[i](e.data); } catch (_) {}
      }
    };
  } catch (_) {}

  function meshBroadcast(kind, payload) {
    if (!FORK) return null;
    if (FORK.mesh_stance === 'private' && kind !== 'tool_visited') return null;
    var env = {
      version: 'niceassos-mesh-v1',
      kind: kind || 'beacon',
      fork_pub: FORK.konomi_pub,
      ts: new Date().toISOString(),
      seq: 0,    // shim doesn't maintain seq · mesh client does
      prev_hash: null,
      payload: Object.assign({ tool: TOOL_ID, organ: ORGAN }, payload || {}),
      signature: null,  // shim-emitted envelopes are unsigned · mesh client signs
    };
    if (meshCh) try { meshCh.postMessage(env); } catch (_) {}
    // legacy fall-signal compat
    try { new BroadcastChannel('fall-signal').postMessage({ kind: 'mesh.envelope', envelope: env }); } catch (_) {}
    return env;
  }

  // ====================================================================
  // FORK BADGE UI
  // ====================================================================

  var BADGE_STYLE = ''
    + '#nas-badge{position:fixed;top:12px;right:12px;z-index:99999;'
    + 'font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10px;'
    + 'text-transform:uppercase;letter-spacing:.15em;color:#b8974a;'
    + 'background:rgba(11,10,15,.86);border:1px solid rgba(184,151,74,.35);'
    + 'padding:6px 10px;border-radius:2px;backdrop-filter:blur(6px);'
    + 'cursor:pointer;transition:all .15s;text-decoration:none;display:inline-flex;align-items:center;gap:6px;}'
    + '#nas-badge:hover{border-color:#b8974a;background:rgba(184,151,74,.08);}'
    + '#nas-badge .dot{width:6px;height:6px;border-radius:50%;background:#3a7d3a;}'
    + '#nas-badge .h{color:#c4bfb2;}'
    + '#nas-badge.absent .dot{background:#7c7466;}'
    + '#nas-badge.absent{color:#7c7466;}'
    + '@media (max-width:560px){#nas-badge{font-size:9px;padding:4px 8px;}}';

  function renderBadge() {
    if (document.getElementById('nas-badge')) return;
    if (DATA.badge === 'false') return;
    var style = document.createElement('style');
    style.id = 'nas-badge-style';
    style.textContent = BADGE_STYLE;
    document.head.appendChild(style);
    var a = document.createElement('a');
    a.id = 'nas-badge';
    a.href = 'https://sjgant80-hub.github.io/niceassos-seed/seed.html';
    a.target = '_blank';
    a.rel = 'noopener';
    if (FORK) {
      a.innerHTML = '<span class="dot"></span>◊ fork: <span class="h">'
        + (FORK.handle || ('fork-' + FORK.konomi_pub.slice(0,6)))
        + '</span> · ' + (FORK.verdict && FORK.verdict.vertical || 'unknown');
      a.title = 'NiceAssOS fork · ' + FORK.konomi_pub.slice(0,16) + '… · stance: ' + FORK.mesh_stance + ' · click to re-probe';
    } else {
      a.className = 'absent';
      a.innerHTML = '<span class="dot"></span>◊ no fork · seed';
      a.title = 'No NiceAssOS fork detected · click to bootstrap';
    }
    document.body.appendChild(a);
  }

  // ====================================================================
  // AUTO-INGEST FORM SUBMITS
  // ====================================================================

  function bindAutoIngest() {
    if (!FORK) return;
    document.addEventListener('submit', function(e) {
      try {
        var f = e.target;
        if (!f || f.tagName !== 'FORM') return;
        var data = {};
        var hasText = false;
        Array.prototype.forEach.call(f.elements || [], function(el) {
          if (!el.name) return;
          if (el.type === 'password') return;  // never ingest passwords
          if (el.type === 'hidden') return;
          var val = (el.value || '').toString();
          if (val) { data[el.name] = val; if (val.length > 4) hasText = true; }
        });
        if (!hasText) return;
        var summary = Object.keys(data).map(function(k){ return k + ': ' + data[k]; }).join(' | ').slice(0, 1000);
        cubeIngest(summary, { kind: 'form-submit', form_id: f.id || null, action: f.action || null });
      } catch (_) {}
    }, true);
  }

  // ====================================================================
  // COPY VOICE HELPER
  // ====================================================================

  function applyCopyVoice() {
    if (!FORK || !FORK.copy_voice) return;
    document.documentElement.setAttribute('data-nas-voice', FORK.copy_voice);
    document.documentElement.setAttribute('data-nas-vertical', (FORK.verdict && FORK.verdict.vertical) || 'unknown');
    document.documentElement.setAttribute('data-nas-segment', (FORK.verdict && FORK.verdict.segment) || 'unknown');
  }

  // ====================================================================
  // PUBLIC API
  // ====================================================================

  var nas = {
    version: '0.1.0',
    organ:  ORGAN,
    layer:  LAYER,
    tool:   TOOL_ID,
    ready:  null,   // promise that resolves once fork is detected
    fork:   null,   // the fork.config.json or null
    verdict: null,  // the cluster verdict or null

    ingest: function(text, meta) { return cubeIngest(text, meta); },
    recall: function(query, k)   { return cubeRecall(query, k); },
    broadcast: function(kind, payload) { return meshBroadcast(kind, payload); },
    onEnvelope: function(handler) { if (typeof handler === 'function') meshHandlers.push(handler); },
    isForkPresent: function() { return !!FORK; },

    // helpers for tools that want to swap behavior by verdict
    voice: function() { return FORK ? FORK.copy_voice : null; },
    vertical: function() { return FORK && FORK.verdict ? FORK.verdict.vertical : null; },
    segment:  function() { return FORK && FORK.verdict ? FORK.verdict.segment  : null; },
    organs:   function() { return FORK ? (FORK.organs || []) : []; },
    handle:   function() { return FORK ? (FORK.handle || ('fork-' + FORK.konomi_pub.slice(0,8))) : null; },

    // utility: re-detect (after seed runs in another tab)
    refresh: async function() {
      FORK = await detectFork();
      nas.fork = FORK; nas.verdict = FORK ? FORK.verdict : null;
      applyCopyVoice();
      renderBadge();
      return FORK;
    },
  };

  window.nas = nas;

  // ====================================================================
  // BOOT
  // ====================================================================

  function boot() {
    nas.ready = (async function() {
      FORK = await detectFork();
      nas.fork = FORK;
      nas.verdict = FORK ? FORK.verdict : null;
      applyCopyVoice();
      renderBadge();
      bindAutoIngest();
      // emit tool_visited (always · respects stance internally)
      meshBroadcast('tool_visited', {
        title: document.title,
        path: location.pathname,
      });
      // fire custom event for tools that want to react
      try {
        document.dispatchEvent(new CustomEvent('nas:ready', { detail: { fork: FORK, organ: ORGAN, tool: TOOL_ID } }));
      } catch (_) {}
      log('ready', { fork: !!FORK, organ: ORGAN, tool: TOOL_ID });
      return nas;
    })();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
