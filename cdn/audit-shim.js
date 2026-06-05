/*! ◊·κ=1 · fall-euaiact audit shim · v1.0.0 · MIT · Article 12 record-keeping
 *
 * Drop-in browser shim · SHA-256 prevHash chain · IndexedDB persistent
 * Attaches: window.EUAIActAudit = { createAuditShim, version, tier }
 *
 * Usage (one line in any sovereign HTML):
 *   <script src="https://sjgant80-hub.github.io/fall-euaiact/cdn/audit-shim.js"
 *           data-tool="fallcrm" data-tier="minimal"></script>
 *
 * After load:
 *   window.__audit = window.EUAIActAudit.createAuditShim({ dbName: 'fallcrm-audit' });
 *   await window.__audit.log({ type: 'classify', input: '...', output: '...' });
 *   const proof = await window.__audit.verifyChain();
 *
 * Source: https://github.com/sjgant80-hub/fall-euaiact
 */
(function (root) {
  'use strict';

  var VERSION = '1.0.0';

  function createAuditShim(opts) {
    opts = opts || {};
    var dbName = opts.dbName || 'eu-aiact-audit';
    var sink = opts.sink || (typeof indexedDB !== 'undefined' ? 'indexeddb' : 'memory');
    var prevHash = repeat0(64);
    var db = null;
    var memoryStore = [];

    function repeat0(n) { var s = ''; while (s.length < n) s += '0'; return s; }

    function sha256(s) {
      var buf = new TextEncoder().encode(s);
      return crypto.subtle.digest('SHA-256', buf).then(function (h) {
        var arr = new Uint8Array(h), out = '';
        for (var i = 0; i < arr.length; i++) {
          var hex = arr[i].toString(16);
          if (hex.length < 2) hex = '0' + hex;
          out += hex;
        }
        return out;
      });
    }

    function openDb() {
      if (sink !== 'indexeddb' || db) return Promise.resolve(db);
      return new Promise(function (res, rej) {
        var r = indexedDB.open(dbName, 1);
        r.onupgradeneeded = function (e) {
          var d = e.target.result;
          if (!d.objectStoreNames.contains('log')) {
            d.createObjectStore('log', { keyPath: 'id', autoIncrement: true });
          }
        };
        r.onsuccess = function (e) { db = e.target.result; res(db); };
        r.onerror = function (e) { rej(e.target.error); };
      });
    }

    function log(event) {
      event = event || {};
      var entry = {
        ts: new Date().toISOString(),
        event_type: event.type || 'unknown',
        input_summary: typeof event.input === 'string' ? event.input.slice(0, 200) : null,
        output_summary: typeof event.output === 'string' ? event.output.slice(0, 200) : null,
        operator_id: event.operator || null,
        metadata: event.metadata || null,
        prev_hash: prevHash,
      };
      return sha256(JSON.stringify(entry)).then(function (h) {
        entry.hash = h;
        prevHash = h;
        if (sink === 'indexeddb') {
          return openDb().then(function () {
            return new Promise(function (res, rej) {
              var tx = db.transaction('log', 'readwrite');
              tx.objectStore('log').add(entry);
              tx.oncomplete = function () { res(entry); };
              tx.onerror = function (e) { rej(e.target.error); };
            });
          });
        } else {
          memoryStore.push(entry);
          return entry;
        }
      });
    }

    function exportAll() {
      if (sink === 'indexeddb') {
        return openDb().then(function () {
          return new Promise(function (res, rej) {
            var tx = db.transaction('log', 'readonly');
            var r = tx.objectStore('log').getAll();
            r.onsuccess = function () { res(r.result); };
            r.onerror = function (e) { rej(e.target.error); };
          });
        });
      }
      return Promise.resolve(memoryStore.slice());
    }

    function verifyChain() {
      return exportAll().then(function (all) {
        var expected = repeat0(64);
        var chain = Promise.resolve({ valid: true, total: all.length });
        for (var i = 0; i < all.length; i++) {
          (function (entry, idx) {
            chain = chain.then(function (state) {
              if (!state.valid) return state;
              if (entry.prev_hash !== expected) {
                return { valid: false, broken_at: idx, total: all.length, reason: 'prev_hash mismatch' };
              }
              var rest = {};
              for (var k in entry) if (k !== 'hash' && k !== 'id') rest[k] = entry[k];
              return sha256(JSON.stringify(rest)).then(function (computed) {
                if (computed !== entry.hash) {
                  return { valid: false, broken_at: idx, total: all.length, reason: 'hash mismatch' };
                }
                expected = entry.hash;
                return state;
              });
            });
          })(all[i], i);
        }
        return chain;
      });
    }

    function clear() {
      if (sink === 'indexeddb') {
        return openDb().then(function () {
          return new Promise(function (res, rej) {
            var tx = db.transaction('log', 'readwrite');
            tx.objectStore('log').clear();
            tx.oncomplete = function () { prevHash = repeat0(64); res(); };
            tx.onerror = function (e) { rej(e.target.error); };
          });
        });
      }
      memoryStore = [];
      prevHash = repeat0(64);
      return Promise.resolve();
    }

    return { log: log, exportAll: exportAll, verifyChain: verifyChain, clear: clear };
  }

  // ─── auto-bootstrap from <script data-tool="..." data-tier="..."> ───
  function autoBootstrap() {
    try {
      var scripts = document.querySelectorAll('script[src*="audit-shim"]');
      var self = scripts[scripts.length - 1];
      if (!self) return;
      var tool = self.getAttribute('data-tool');
      var tier = self.getAttribute('data-tier') || 'minimal';
      if (!tool) return;
      var dbName = tool + '-audit';
      root.__audit = createAuditShim({ dbName: dbName });
      root.__auditMeta = { tool: tool, tier: tier, version: VERSION, dbName: dbName };
      // mesh signal · tells other Fall* tools this one is Article-12-compliant
      try {
        var bc = new BroadcastChannel('fall-signal');
        bc.postMessage({
          source: tool,
          kind: 'euaiact:ready',
          payload: { tier: tier, version: VERSION, article: 12 }
        });
      } catch (_) {}
    } catch (_) {}
  }

  root.EUAIActAudit = {
    createAuditShim: createAuditShim,
    version: VERSION,
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', autoBootstrap);
    } else {
      autoBootstrap();
    }
  }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
