/*!
 * fall-forge.js · estate-wide forge wizard · drops into any sovereign tool
 * ◊·κ=φ⁴ · prime 1333
 *
 * One-line dependency:
 *   <script src="https://sjgant80-hub.github.io/fall-euaiact/cdn/fall-forge.js" defer></script>
 *
 * Public API:
 *   window.FallForge.openWizard({
 *     context: {                            // optional · pre-fills the wizard
 *       domain: 'gym',
 *       brand:  { name: 'Acme Co', primary_color: '#b8974a' },
 *       expert_description: '...',
 *       workflow_steps: ['intake', 'assess', '...'],
 *       konomi_pub: '...',                  // injected into the forged HTML
 *       fallmind_namespace: 'fork-abcd1234',
 *     },
 *     onForged: (organ) => { ... }          // organ = { id, name, blob, blobUrl, meta, source }
 *   });
 *
 *   window.FallForge.listLocalOrgans()      // → [...stored organs]
 *   window.FallForge.deleteLocalOrgan(id)
 *   window.FallForge.downloadLocalOrgan(id)
 *
 * The wizard:
 *   1. collects a brief (or auto-uses context)
 *   2. POSTs to forge-lab API (the existing Render service we patched today)
 *   3. receives base64 HTML
 *   4. patches the HTML to inject the user's fork context (Konomi pub, brand, namespace)
 *   5. stores the result in IndexedDB under 'fall-forge-organs'
 *   6. surfaces the organ via a Blob URL · works iframe-able
 *   7. fires onForged callback so the host shell can add it to its sidebar
 *
 * Storage:
 *   IndexedDB · DB name 'fall-forge' · store 'organs'
 *   Each entry: { id, name, brand, prime, forged_at, blob (Blob), meta }
 *
 * MIT · Architecture: Thomas Frumkin · Implementation: Simon Gant
 */
(function() {
  'use strict';
  if (window.FallForge) return;

  const FORGE_API = 'https://forge-lab-p9lm.onrender.com';
  const DB_NAME = 'fall-forge';
  const DB_VER = 1;

  // ─── IndexedDB ─────────────────────────────────────────────────
  function openDB() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, DB_VER);
      r.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('organs')) db.createObjectStore('organs', { keyPath: 'id' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function dbPut(s, v)        { const db = await openDB(); return new Promise((res, rej) => { const tx = db.transaction(s, 'readwrite'); tx.objectStore(s).put(v); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }
  async function dbGet(s, k)        { const db = await openDB(); return new Promise((res, rej) => { const tx = db.transaction(s, 'readonly'); const q = tx.objectStore(s).get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
  async function dbDelete(s, k)     { const db = await openDB(); return new Promise((res, rej) => { const tx = db.transaction(s, 'readwrite'); tx.objectStore(s).delete(k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }
  async function dbAll(s)           { const db = await openDB(); return new Promise((res, rej) => { const tx = db.transaction(s, 'readonly'); const q = tx.objectStore(s).getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => rej(q.error); }); }

  // ─── HTML patcher · inject fork context ────────────────────────
  function patchForgedHtml(rawHtml, ctx) {
    let html = rawHtml;
    // Inject the fork's Konomi pubkey if a placeholder exists
    if (ctx.konomi_pub) {
      html = html.replace(/__FORK_KONOMI_PUB__/g, escapeAttr(ctx.konomi_pub));
    }
    // Inject brand swatch placeholder
    if (ctx.brand?.primary_color) {
      html = html.replace(/__BRAND_PRIMARY__/g, escapeAttr(ctx.brand.primary_color));
    }
    if (ctx.brand?.name) {
      html = html.replace(/__BRAND_NAME__/g, escapeAttr(ctx.brand.name));
    }
    // Always inject a small <script> at the end with the fork context so
    // any organ template can read window.__FORK__ for cube / mesh wiring.
    const ctxScript = `
<script>
window.__FORK__ = ${JSON.stringify({
        konomi_pub: ctx.konomi_pub || null,
        fallmind_namespace: ctx.fallmind_namespace || null,
        brand: ctx.brand || null,
        forged_at: new Date().toISOString(),
        forged_via: 'fall-forge.js',
      })};
</script>
`;
    html = html.replace('</body>', ctxScript + '</body>');
    return html;
  }

  function escapeAttr(s) { return String(s).replace(/"/g, '&quot;'); }
  function slug(s) { return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0, 40); }

  // ─── Call forge API ────────────────────────────────────────────
  async function callForge(brief, onProgress) {
    onProgress?.('parse → map → select → build → verify');
    const r = await fetch(FORGE_API + '/v1/forge/expert', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'x-api-key': 'public-demo' },
      body: JSON.stringify(brief),
    });
    if (!r.ok) {
      let err = 'forge HTTP ' + r.status;
      try { const j = await r.json(); err = j.error || err; } catch(_) {}
      throw new Error(err);
    }
    const j = await r.json();
    if (!j.tool_file) throw new Error('forge: empty response');
    return j;
  }

  // ─── Wizard UI (modal injected into the host page) ─────────────
  let _modal = null;
  function openWizard(opts) {
    opts = opts || {};
    const ctx = opts.context || {};
    if (_modal) _modal.remove();

    const wrap = document.createElement('div');
    wrap.id = 'fall-forge-modal';
    wrap.innerHTML = `
<style>
#fall-forge-modal{position:fixed;inset:0;z-index:99998;display:flex;align-items:flex-start;justify-content:center;padding:32px 16px;background:rgba(0,0,0,.86);backdrop-filter:blur(6px);overflow-y:auto;font-family:'Inter',-apple-system,sans-serif}
#fall-forge-modal .ff-box{background:#0b0a0f;border:1px solid #b8974a;max-width:720px;width:100%;padding:28px;border-radius:2px;color:#c4bfb2;box-shadow:0 20px 80px rgba(0,0,0,.8);position:relative}
#fall-forge-modal h2{font-family:'Libre Baskerville',Georgia,serif;font-weight:400;font-size:26px;color:#b8974a;margin:0 0 8px}
#fall-forge-modal .ff-sub{font-family:'IBM Plex Mono',monospace;font-size:11px;color:#7c7466;text-transform:uppercase;letter-spacing:.18em;margin-bottom:18px}
#fall-forge-modal label{display:block;font-family:'IBM Plex Mono',monospace;font-size:10px;color:#7c7466;text-transform:uppercase;letter-spacing:.12em;margin:14px 0 6px}
#fall-forge-modal input,#fall-forge-modal textarea,#fall-forge-modal select{width:100%;padding:10px 12px;background:rgba(0,0,0,.45);border:1px solid rgba(184,151,74,.2);color:#c4bfb2;font-family:inherit;font-size:14px;border-radius:2px;outline:none}
#fall-forge-modal textarea{min-height:80px;font-family:'IBM Plex Mono',monospace;font-size:13px;line-height:1.55;resize:vertical}
#fall-forge-modal input:focus,#fall-forge-modal textarea:focus,#fall-forge-modal select:focus{border-color:#b8974a}
#fall-forge-modal .ff-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
#fall-forge-modal .ff-btn{display:inline-flex;align-items:center;gap:6px;padding:10px 18px;background:transparent;border:1px solid #b8974a;color:#b8974a;font-family:'IBM Plex Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.12em;cursor:pointer;border-radius:2px;transition:all .15s;text-decoration:none}
#fall-forge-modal .ff-btn:hover{background:#b8974a;color:#0b0a0f}
#fall-forge-modal .ff-btn.primary{background:#b8974a;color:#0b0a0f}
#fall-forge-modal .ff-btn.primary:hover{background:#c4bfb2;border-color:#c4bfb2}
#fall-forge-modal .ff-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:18px;flex-wrap:wrap}
#fall-forge-modal .ff-close{position:absolute;top:14px;right:18px;background:none;border:none;color:#7c7466;font-size:22px;cursor:pointer}
#fall-forge-modal .ff-close:hover{color:#b8974a}
#fall-forge-modal .ff-status{font-family:'IBM Plex Mono',monospace;font-size:11px;color:#7c7466;margin:14px 0;min-height:18px}
#fall-forge-modal .ff-success{padding:14px 18px;background:rgba(58,125,58,.1);border-left:3px solid #3a7d3a;color:#c4bfb2;margin:14px 0;border-radius:2px;font-size:14px}
#fall-forge-modal .ff-fail{padding:14px 18px;background:rgba(139,26,26,.1);border-left:3px solid #8b1a1a;color:#c4bfb2;margin:14px 0;border-radius:2px;font-size:14px}
#fall-forge-modal .ff-hint{font-family:'IBM Plex Mono',monospace;font-size:10px;color:#7c7466;margin-top:4px}
#fall-forge-modal a{color:#b8974a;text-decoration:none}
#fall-forge-modal a:hover{text-decoration:underline}
</style>
<div class="ff-box">
  <button class="ff-close" data-action="close">×</button>
  <h2>◊ FallForge · build a new organ for your estate</h2>
  <div class="ff-sub">/the forge runs the 5-stage pipeline · the output is yours · your fork context gets baked in/</div>

  <div id="ff-step-1">
    <label>What does this tool do? (a couple of sentences · the more specific, the better)</label>
    <textarea id="ff-desc" placeholder="e.g. small animal vet practice intake — species, owner, presenting concern, treatment plan, follow-up reminders…">${escapeHtml(ctx.expert_description || '')}</textarea>
    <div class="ff-row">
      <div>
        <label>Domain</label>
        <select id="ff-domain">
          <option value="general">general</option>
          <option value="lab">lab / clinic / clinical</option>
          <option value="legal">legal</option>
          <option value="fitness">fitness / wellness</option>
          <option value="finance">finance / accounting</option>
          <option value="ops">operations</option>
          <option value="creative">creative / agency</option>
          <option value="education">education</option>
          <option value="retail">retail / commerce</option>
          <option value="farming">farming / outdoor</option>
        </select>
      </div>
      <div>
        <label>Brand colour</label>
        <input type="text" id="ff-color" value="${escapeAttr(ctx.brand?.primary_color || '#b8974a')}" placeholder="#b8974a" />
      </div>
    </div>
    <label>Workflow steps (one per line · minimum 2)</label>
    <textarea id="ff-steps" placeholder="intake&#10;assess&#10;plan&#10;deliver&#10;follow-up">${escapeHtml((ctx.workflow_steps || []).join('\n'))}</textarea>
    <label>Tool name</label>
    <input type="text" id="ff-name" value="${escapeAttr(ctx.brand?.name || '')}" placeholder="e.g. Acme Vet Intake" />
    <div class="ff-status" id="ff-status"></div>
    <div class="ff-actions">
      <button class="ff-btn" data-action="close">Cancel</button>
      <button class="ff-btn primary" data-action="forge">Forge it →</button>
    </div>
    <div class="ff-hint">Powered by forge-lab · uses the Anthropic / OpenAI / Gemini provider configured on the forge service · output is fully sovereign, MIT, single-file.</div>
  </div>

  <div id="ff-step-2" style="display:none">
    <div id="ff-result"></div>
  </div>
</div>`;

    document.body.appendChild(wrap);
    _modal = wrap;

    wrap.addEventListener('click', (e) => {
      const t = e.target.closest('[data-action]');
      if (!t) {
        if (e.target.id === 'fall-forge-modal') closeWizard();
        return;
      }
      const action = t.dataset.action;
      if (action === 'close') closeWizard();
      else if (action === 'forge') runForge(opts);
      else if (action === 'open') {
        const id = t.dataset.id;
        const meta = window.__lastForged?.find(o => o.id === id);
        if (meta) loadForgedInline(meta);
      }
      else if (action === 'download') {
        const id = t.dataset.id;
        downloadLocalOrgan(id);
      }
      else if (action === 'done') {
        closeWizard();
      }
    });
  }

  function closeWizard() {
    if (_modal) { _modal.remove(); _modal = null; }
  }

  async function runForge(opts) {
    const ctx = opts.context || {};
    const desc = document.getElementById('ff-desc').value.trim();
    const domain = document.getElementById('ff-domain').value;
    const color = document.getElementById('ff-color').value.trim();
    const name = document.getElementById('ff-name').value.trim();
    const steps = document.getElementById('ff-steps').value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const status = document.getElementById('ff-status');

    if (desc.length < 20) { status.textContent = '✗ describe what it does (min 20 chars)'; return; }
    if (steps.length < 2) { status.textContent = '✗ add at least 2 workflow steps'; return; }

    const brief = {
      domain,
      expert_description: desc,
      workflow_steps: steps,
      data_fields: { auto_detect: true },
      brand: { name: name || undefined, primary_color: color || undefined },
    };

    status.textContent = '◊ forging · parse → map → select → build → verify…';
    const btnRow = document.querySelector('#fall-forge-modal .ff-actions');
    btnRow.querySelectorAll('.ff-btn').forEach(b => b.disabled = true);
    try {
      const result = await callForge(brief, (msg) => { status.textContent = '◊ ' + msg; });
      // patch HTML with fork context
      const rawHtml = atob(result.tool_file);
      const ctxForPatch = {
        konomi_pub: ctx.konomi_pub || (window.nas?.fork?.konomi_pub),
        fallmind_namespace: ctx.fallmind_namespace || (window.nas?.fork?.fallmind_namespace),
        brand: brief.brand,
      };
      const patched = patchForgedHtml(rawHtml, ctxForPatch);
      const blob = new Blob([patched], { type: 'text/html' });
      const blobUrl = URL.createObjectURL(blob);
      const id = 'O_' + Date.now().toString(36) + '_' + slug(name || result.forge_meta?.tool_name || 'organ');
      const organ = {
        id,
        name: result.forge_meta?.tool_name || name || 'Forged Organ',
        forged_at: new Date().toISOString(),
        domain,
        prime: result.licence?.prime,
        size_kb: result.size_kb,
        agents: (result.detected_agents || []).map(a => a.name || a),
        stages: (result.ass_stages || []).map(s => s.label || s),
        verification: result.verification,
        meta: result.forge_meta || {},
        brand: brief.brand,
        source: 'fall-forge',
      };
      // store blob + meta separately (Blob can be stored directly in IndexedDB)
      await dbPut('organs', { ...organ, blob });

      // fire onForged
      const surfaceOrgan = { ...organ, blobUrl };
      window.__lastForged = window.__lastForged || [];
      window.__lastForged.push(surfaceOrgan);
      try { opts.onForged?.(surfaceOrgan); } catch (e) { console.warn('[fall-forge] onForged threw', e); }

      // broadcast on fall-signal for any listening organ to react
      try {
        new BroadcastChannel('fall-signal').postMessage({
          kind: 'fall-forge:organ_minted',
          organ: { id, name: organ.name, prime: organ.prime, forged_at: organ.forged_at },
        });
      } catch(_) {}

      // success surface
      document.getElementById('ff-step-1').style.display = 'none';
      document.getElementById('ff-step-2').style.display = 'block';
      const verifMark = result.verification?.ok ? '✓' : '⚠';
      const verifColor = result.verification?.ok ? '#3a7d3a' : '#d4a857';
      document.getElementById('ff-result').innerHTML = `
        <div class="ff-success" style="border-left-color:${verifColor}">
          <strong>${verifMark} ${escapeHtml(organ.name)} forged</strong><br>
          ${result.size_kb || '?'} kB · prime ${organ.prime || '?'} ·
          verification ${result.verification?.passed || 0}/${result.verification?.total || 0} ·
          stored locally in this browser
        </div>
        <p style="font-size:14px;line-height:1.6">Your forge is in your fork. It carries your Konomi key, your brand, your cube namespace.
          It will broadcast on <code>fall-signal</code> like any other organ and FallLearn will be able to teach against it.</p>
        <div class="ff-actions" style="justify-content:flex-start">
          <button class="ff-btn primary" data-action="open" data-id="${id}">Open it now ↗</button>
          <button class="ff-btn" data-action="download" data-id="${id}">Download .html</button>
          <button class="ff-btn" data-action="done">Done</button>
        </div>
        <div class="ff-hint" style="margin-top:14px">To register this on a public URL: host the downloaded HTML in any GitHub Pages / Netlify / your own server. Add an entry to <a href="https://github.com/sjgant80-hub/fall-registry">fall-registry</a> so the rest of the estate finds it.</div>
      `;
    } catch (e) {
      status.innerHTML = `<div class="ff-fail">✗ ${escapeHtml(e.message)}</div>
        <p style="font-size:13px;line-height:1.6">If the message mentions "credit" / "balance" / "quota" — the forge-lab API key is exhausted. The maintainer can add a free Gemini key via Render env to fix this. Forge logic and the wizard are fine; only the upstream LLM is down.</p>`;
      btnRow.querySelectorAll('.ff-btn').forEach(b => b.disabled = false);
    }
  }

  function escapeHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  // ─── public helpers ────────────────────────────────────────────
  async function listLocalOrgans() {
    const items = await dbAll('organs');
    return items.map(o => {
      const blob = o.blob;
      const url = blob ? URL.createObjectURL(blob) : null;
      return { ...o, blobUrl: url };
    });
  }
  async function deleteLocalOrgan(id) {
    await dbDelete('organs', id);
    try { new BroadcastChannel('fall-signal').postMessage({ kind: 'fall-forge:organ_deleted', id }); } catch(_) {}
  }
  async function downloadLocalOrgan(id) {
    const item = await dbGet('organs', id);
    if (!item || !item.blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(item.blob);
    a.download = (slug(item.name) || 'forged') + '.html';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function loadForgedInline(meta) {
    // optional helper: if a frame element with id 'fall-forge-target' exists, load there
    const target = document.getElementById('fall-forge-target');
    if (target) {
      const item = await dbGet('organs', meta.id);
      if (item?.blob) {
        const f = document.createElement('iframe');
        f.src = URL.createObjectURL(item.blob);
        f.style.cssText = 'width:100%;height:100%;border:none;background:#fff';
        target.innerHTML = '';
        target.appendChild(f);
      }
    } else if (meta.blobUrl) {
      window.open(meta.blobUrl, '_blank');
    }
  }

  // ─── expose ────────────────────────────────────────────────────
  window.FallForge = {
    version: '0.1.0',
    openWizard,
    listLocalOrgans,
    deleteLocalOrgan,
    downloadLocalOrgan,
    loadForgedInline,
  };

  // notify listeners that FallForge is available
  try {
    document.dispatchEvent(new CustomEvent('fall-forge:ready', { detail: { version: '0.1.0' } }));
  } catch(_) {}
})();
