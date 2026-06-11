/*!
 * mistake-shim.js · estate-wide failure telemetry for the FallLearn v2 mistake bus
 * ◊·κ=φ⁴ · prime 1331
 *
 * Drops into any estate tool. Watches for common UI-layer failures and
 * emits a structured mistake event on the fall-signal BroadcastChannel.
 *
 *   { kind: 'mistake', organ: <tool>, action: <what>, field: <which>, ts, ctx }
 *
 * FallLearn subscribes to these and queues a 90-second targeted lesson the
 * next time the operator opens the tutor.
 *
 * Design constraints:
 *   - Zero-config drop-in. Reads <meta name="aios-organ"> for organ id.
 *   - No data exfiltration. Mistakes stay on-device via BroadcastChannel.
 *   - Idempotent. Multiple loads are safe.
 *   - Heuristic. False positives are noise, not data loss — bias toward not firing.
 *
 *   <script src="https://sjgant80-hub.github.io/fall-euaiact/cdn/mistake-shim.js"
 *           data-tool="gymops"></script>
 *
 * Architecture: Thomas Frumkin · Implementation: Simon Gant · MIT
 */
(function() {
  'use strict';
  if (window.__mistakeShimLoaded) return;
  window.__mistakeShimLoaded = true;

  var SCRIPT = document.currentScript || (function() {
    var s = document.querySelectorAll('script[src*="mistake-shim"]');
    return s[s.length - 1];
  })();
  var DATA = SCRIPT ? SCRIPT.dataset : {};
  var ORGAN = DATA.tool
    || (document.querySelector('meta[name="aios-organ"]') || {}).content
    || (document.querySelector('meta[name="aios-tool"]') || {}).content
    || location.pathname.split('/').filter(Boolean).pop()
    || 'unknown';

  var ch = null;
  try { ch = new BroadcastChannel('fall-signal'); } catch (_) { return; }

  function emit(kind_detail, info) {
    try {
      ch.postMessage(Object.assign({
        kind: 'mistake',
        sub: kind_detail,
        organ: ORGAN,
        ts: new Date().toISOString(),
      }, info || {}));
    } catch (_) {}
  }

  // ─── HEURISTIC 1 · invalid form submit ─────────────────────────
  // When the user tries to submit a form that fails native validation,
  // emit a single mistake event listing the first invalid field.
  document.addEventListener('invalid', function(e) {
    var el = e.target;
    if (!el || !el.name) return;
    emit('form_invalid', {
      field: el.name,
      action: 'submit',
      message: el.validationMessage || null,
      form_id: (el.form && el.form.id) || null,
    });
  }, true);

  // ─── HEURISTIC 2 · empty required field at submit time ─────────
  document.addEventListener('submit', function(e) {
    try {
      var f = e.target;
      if (!f || f.tagName !== 'FORM') return;
      var missing = [];
      Array.prototype.forEach.call(f.elements || [], function(el) {
        if (!el.name) return;
        if (el.required && !(el.value || '').trim()) missing.push(el.name);
      });
      if (missing.length) {
        emit('required_missing', {
          fields: missing,
          field: missing[0],
          action: 'submit',
          form_id: f.id || null,
        });
      }
    } catch (_) {}
  }, true);

  // ─── HEURISTIC 3 · network error on fetch (only when we own the page) ──
  var origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = function() {
      var args = arguments;
      var p = origFetch.apply(this, args);
      return p.then(function(r) {
        if (r && r.status >= 400 && r.status < 600) {
          try {
            var url = (typeof args[0] === 'string') ? args[0] : (args[0] && args[0].url);
            if (url && /^(https?:)?\/\//.test(url)) {
              // skip cross-origin third-party errors that aren't our concern
              try {
                var u = new URL(url, location.href);
                if (u.host !== location.host && !/sjgant80-hub|onrender|ai-nativesolutions/.test(u.host)) {
                  return r;
                }
              } catch (_) {}
            }
            emit('http_error', { action: 'fetch', url: url, status: r.status });
          } catch (_) {}
        }
        return r;
      }).catch(function(err) {
        try {
          var url = (typeof args[0] === 'string') ? args[0] : (args[0] && args[0].url);
          emit('network_error', { action: 'fetch', url: url || null, message: (err && err.message) || 'fetch failed' });
        } catch (_) {}
        throw err;
      });
    };
  }

  // ─── HEURISTIC 4 · console errors thrown by the page itself ─────
  window.addEventListener('error', function(e) {
    if (!e || !e.message) return;
    // skip noise from extensions / third-party scripts
    if (e.filename && !/^(https?:)?\/\//.test(e.filename)) return;
    if (e.filename && /(extensions|chrome-extension|moz-extension)/.test(e.filename)) return;
    emit('runtime_error', { action: 'render', message: String(e.message).slice(0, 240) });
  }, true);

  // ─── HEURISTIC 5 · explicit emit API for tools that want to report ──
  window.fallLearnMistake = function(detail) {
    if (!detail) return;
    emit(detail.sub || 'explicit', Object.assign({ action: 'explicit' }, detail));
  };

  // Boot ping (lets FallLearn know the shim is live in this tool)
  emit('shim_loaded', { action: 'boot', note: 'mistake-shim listening · ' + ORGAN });
})();
