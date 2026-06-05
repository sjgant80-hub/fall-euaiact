// ◊·κ=1 · fall-euaiact estate ripple
// injects <script src="...audit-shim.js" data-tool="X" data-tier="Y"> into every Fall* repo
// run from this script's dir · OR set DOWNLOADS env var
// usage: node ripple-audit-shim.mjs [--dry] [--push]

import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';

const DOWNLOADS = process.env.DOWNLOADS || 'C:/Users/sjgan/Downloads';
const DRY = process.argv.includes('--dry');
const PUSH = process.argv.includes('--push');
const CDN_URL = 'https://sjgant80-hub.github.io/fall-euaiact/cdn/audit-shim.js';

// ─── tier classification by repo name ───
// most are minimal · few are limited (chatbot / AI-generated content) · 0 high in this estate
const REPO_MAP = {
  // LIMITED · chatbot / AI-generated content shown to humans · Article 50 disclosure
  'fallcrm':        { tier: 'limited', tool: 'fallcrm',  prime: 401 },
  'fallcarousel':   { tier: 'limited', tool: 'fallcarousel', prime: null },
  'fallpost':       { tier: 'limited', tool: 'fallpost', prime: 503 },
  'fallap':         { tier: 'limited', tool: 'fallap', prime: null },
  'fall-substrate': { tier: 'limited', tool: 'fall-substrate', prime: 419 },
  'fall-raas':      { tier: 'limited', tool: 'fall-raas', prime: 421 },
  'fall-verify':    { tier: 'limited', tool: 'fall-verify', prime: 431 },
  'fallmirror':     { tier: 'limited', tool: 'fallmirror', prime: null },
  'fallmind':       { tier: 'limited', tool: 'fallmind', prime: null },
  'fall-vetter':    { tier: 'limited', tool: 'fall-vetter', prime: null },
  'shadowcompass':  { tier: 'limited', tool: 'shadowcompass', prime: null },
  'fall-kqtt-bridge': { tier: 'limited', tool: 'fall-kqtt-bridge', prime: 599 },
  // MINIMAL · tools / calculators / schedulers / dashboards
  'fallinvoice':    { tier: 'minimal', tool: 'fallinvoice', prime: null },
  'fallflow':       { tier: 'minimal', tool: 'fallflow', prime: null },
  'fallhire':       { tier: 'minimal', tool: 'fallhire', prime: null },
  'fallaccount':    { tier: 'minimal', tool: 'fallaccount', prime: 31 },
  'fallforce':      { tier: 'minimal', tool: 'fallforce', prime: 709 },
  'fallcompass':    { tier: 'minimal', tool: 'fallcompass', prime: null },
  'fallcube-api':   { tier: 'minimal', tool: 'fallcube-api', prime: null },
  'fallescape':     { tier: 'minimal', tool: 'fallescape', prime: null },
  'fallfence':      { tier: 'minimal', tool: 'fallfence', prime: null },
  'fallgo':         { tier: 'minimal', tool: 'fallgo', prime: null },
  'fallharmony':    { tier: 'minimal', tool: 'fallharmony', prime: 601 },
  'fallnet':        { tier: 'minimal', tool: 'fallnet', prime: null },
  'falloffice':     { tier: 'minimal', tool: 'falloffice', prime: 7 },
  'fallonion':      { tier: 'minimal', tool: 'fallonion', prime: null },
  'fallpay':        { tier: 'minimal', tool: 'fallpay', prime: null },
  'fallsalescrm':   { tier: 'minimal', tool: 'fallsalescrm', prime: null },
  'fallscout':      { tier: 'minimal', tool: 'fallscout', prime: null },
  'fallshield':     { tier: 'minimal', tool: 'fallshield', prime: null },
  'fallskin':       { tier: 'minimal', tool: 'fallskin', prime: null },
  'fallvault':      { tier: 'minimal', tool: 'fallvault', prime: null },
  'fallanno':       { tier: 'minimal', tool: 'fallanno', prime: null },
  'gymos':          { tier: 'minimal', tool: 'gymos', prime: null },
  'gymos-export':   { tier: 'minimal', tool: 'gymos-export', prime: null },
  'forge-lab':      { tier: 'minimal', tool: 'forge-lab', prime: null },
  'cassietorusbtc135solver': { tier: 'minimal', tool: 'cassie-torus', prime: 137 },
  'cassie-oracle-3': { tier: 'minimal', tool: 'cassie-oracle-3', prime: null },
  // SKIPPED · private / not user-facing / no index.html
  // fall-euaiact (the source) · cassie-anthropic (private) · fall-registry-tmp · fallcdn · fall127agents
};

const SKIP = new Set([
  'fall-euaiact', 'cassie-anthropic', 'fall-registry-tmp', 'fallcdn',
  'fall127agents', 'Fall127', 'FallLearn', 'falllearn-kids', 'falllearn-repo'
]);

async function fileExists(p) {
  try { await stat(p); return true; } catch { return false; }
}

function buildScriptTag(meta) {
  return `<script src="${CDN_URL}" data-tool="${meta.tool}" data-tier="${meta.tier}" defer></script>`;
}

const SHIM_MARKER = 'fall-euaiact/cdn/audit-shim.js';

async function rippleRepo(repoDir, meta) {
  const idxPath = path.join(repoDir, 'index.html');
  if (!await fileExists(idxPath)) {
    return { repo: path.basename(repoDir), status: 'no-index', tier: meta.tier };
  }
  let html = await readFile(idxPath, 'utf8');
  if (html.includes(SHIM_MARKER)) {
    return { repo: path.basename(repoDir), status: 'already-rippled', tier: meta.tier };
  }
  const tag = buildScriptTag(meta);
  // inject before </head> · fallback before </body> · fallback prepend
  let injected = html;
  if (/<\/head>/i.test(html)) {
    injected = html.replace(/<\/head>/i, `  ${tag}\n</head>`);
  } else if (/<\/body>/i.test(html)) {
    injected = html.replace(/<\/body>/i, `${tag}\n</body>`);
  } else {
    injected = tag + '\n' + html;
  }
  if (DRY) {
    return { repo: path.basename(repoDir), status: 'dry-would-inject', tier: meta.tier };
  }
  await writeFile(idxPath, injected);
  // git add + commit
  try {
    execSync(`git -C "${repoDir}" add index.html`, { stdio: 'ignore' });
    const msg = `audit · article 12 ripple · tier=${meta.tier} · drop-in shim

· cdn-loaded from fall-euaiact pages
· window.__audit available · IndexedDB sha256 prevHash chain
· tier classification per EU AI Act risk lens
· emits euaiact:ready on fall-signal mesh

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`;
    execSync(`git -C "${repoDir}" commit -m ${JSON.stringify(msg)}`, { stdio: 'ignore' });
    if (PUSH) {
      execSync(`git -C "${repoDir}" push`, { stdio: 'ignore' });
    }
    return { repo: path.basename(repoDir), status: PUSH ? 'committed+pushed' : 'committed', tier: meta.tier };
  } catch (e) {
    return { repo: path.basename(repoDir), status: 'git-failed: ' + (e.message || '').slice(0, 80), tier: meta.tier };
  }
}

async function main() {
  const entries = await readdir(DOWNLOADS);
  const results = [];
  for (const name of entries) {
    if (SKIP.has(name)) continue;
    const repoDir = path.join(DOWNLOADS, name);
    let st;
    try { st = await stat(repoDir); } catch { continue; }
    if (!st.isDirectory()) continue;
    // only act on directories matching our REPO_MAP
    const meta = REPO_MAP[name];
    if (!meta) continue;
    // verify it's a git repo
    if (!await fileExists(path.join(repoDir, '.git'))) {
      results.push({ repo: name, status: 'not-a-repo', tier: meta.tier });
      continue;
    }
    results.push(await rippleRepo(repoDir, meta));
  }
  // report
  console.log('\n◊ ripple report');
  console.log('─'.repeat(80));
  const byStatus = {};
  for (const r of results) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    console.log(`  [${r.tier.padEnd(8)}] ${r.repo.padEnd(28)} → ${r.status}`);
  }
  console.log('─'.repeat(80));
  for (const [s, n] of Object.entries(byStatus)) console.log(`  ${s}: ${n}`);
  console.log(`  total: ${results.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
