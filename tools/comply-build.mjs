#!/usr/bin/env node
// tools/comply-build.mjs — give a build its compliance map, or check the one it has.
//
//   node tools/comply-build.mjs <repo>            write <repo>/compliance.json and <repo>/compliance.html
//   node tools/comply-build.mjs <repo> --check    exit 1 unless the build's map is present, current and shippable
//
// The build declares what it does in <repo>/compliance.decl.json (see comply.mjs → declare). The map is generated
// by comply.mjs from that declaration and this repository's verified law (law/law.json) — never written by hand.
// The check is what konomify's basis gate runs on every build: a missing, stale, hand-edited or prohibited map fails.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = fileURLToPath(new URL('..', import.meta.url));
const { complianceMap } = await import(pathToFileURL(join(HERE, 'comply.mjs')).href);
export const LAW_PATH = join(HERE, 'law', 'law.json');
export const LAW_URL = 'https://github.com/sjgant80-hub/fall-euaiact/blob/main/law/law.json';
export const MAX_AGE_DAYS = 180;
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };   // the local calendar date
// the latest calendar date anywhere on Earth (UTC+14): a map written today in any time zone is never 'in the future'
const latest = () => new Date(Date.now() + 14 * 3600000).toISOString().slice(0, 10);
const days = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function loadLaw() { return readJson(LAW_PATH); }

/** mapFor(repo, asOf) — the map this build's declaration yields today (or at asOf). */
export function mapFor(repo, asOf, law = loadLaw()) {
  const declPath = join(repo, 'compliance.decl.json');
  if (!existsSync(declPath)) return { ok: false, why: 'no compliance.decl.json — declare what the build does (ai, personalData, euOutput, deployment, builtBy, …) and set "declared": true' };
  let decl;
  try { decl = readJson(declPath); } catch (e) { return { ok: false, why: 'compliance.decl.json does not parse: ' + e.message }; }
  const m = complianceMap(decl, law, asOf);
  if (!m.ok) return m;
  return { ...m, build: typeof decl.name === 'string' && decl.name ? decl.name : basename(resolve(repo)), generatedBy: 'fall-euaiact comply.mjs', lawSource: LAW_URL };
}

const STATUS_WORDS = { removed: 'this stack removes it', eased: 'this stack eases it', yours: 'yours to meet', shared: 'shared with the vendor', unchanged: 'applies as written' };
const TIER_WORDS = { prohibited: 'prohibited practice (Art 5)', high: 'high-risk (Art 6(2), Annex III)', limited: 'transparency duties (Art 50)', minimal: 'minimal risk — no tier duties beyond AI literacy (Art 4)' };

/** renderHtml(map, law) — the human page for the map. Deterministic: same map, same bytes. */
export function renderHtml(m, law) {
  const rows = m.items.map((i) => '<tr><td><b>' + esc(i.title) + '</b><br><span class="mono">' + esc(i.regime + ' · ' + i.ref) + '</span><details><summary>the text</summary><p class="q">“' + esc(i.quote) + '” — <a href="' + esc(i.url) + '">source</a>, checked ' + esc(i.checked) + '</p></details></td><td><span class="chip ' + esc(i.status) + '">' + esc(STATUS_WORDS[i.status]) + '</span>' + (i.note ? '<br><span class="sub">' + esc(i.note) + '</span>' : '') + '</td><td class="n">' + (i.inForce ? 'in force' : 'from ' + esc(i.from)) + '</td></tr>').join('\n');
  const dates = law.dates.map((d) => '<tr><td class="n">' + esc(d.date) + '</td><td>' + esc(d.what) + '</td><td><a href="' + esc(d.url) + '">' + esc(d.ref) + '</a></td></tr>').join('\n');
  const ai = m.aiAct.applies
    ? '<p class="big">' + esc(TIER_WORDS[m.aiAct.tier]) + '</p><p>Role: ' + esc(m.aiAct.role) + '.</p>'
    : '<p class="big">Not engaged</p><p>' + esc(m.aiAct.why) + '</p>';
  const gd = '<p class="big">' + (m.gdpr.applies ? 'Engaged' : 'Not engaged') + '</p><p>' + esc(m.gdpr.why) + '</p>';
  const block = m.blocking.length ? '<div class="card block"><b>Blocks shipping:</b> ' + m.blocking.map(esc).join(' ') + '</div>' : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(m.build)} — compliance map</title>
<meta name="description" content="The EU AI Act, GDPR and UK GDPR map for ${esc(m.build)}: role, risk tier, and every duty that applies on its stack, quoted from the primary text and dated." />
<style>
:root{--bg:#f6f7f9;--panel:#fff;--ink:#10151c;--muted:#566172;--line:#dde3ea;--good:#0e9f7e;--warn:#c47d0a;--bad:#d2413a;--accent2:#2f6fed}
@media (prefers-color-scheme:dark){:root{--bg:#0b0d10;--panel:#12161c;--ink:#e7ecf2;--muted:#9aa5b4;--line:#232a34;--good:#39d0a8;--warn:#e8a93a;--bad:#f06a60;--accent2:#6d9bff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,sans-serif}
.wrap{max-width:1040px;margin:0 auto;padding:28px 16px 48px}a{color:var(--accent2)}h1{font-size:clamp(1.5rem,4vw,2.2rem);margin:.2rem 0 .4rem;letter-spacing:-.02em}
.k{font:700 .72rem ui-monospace,Consolas,monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--good)}.sub{color:var(--muted);font-size:.85rem}.mono{font:.8rem ui-monospace,Consolas,monospace;color:var(--muted)}
.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));margin:16px 0}.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.big{font-size:1.25rem;font-weight:800;margin:.2rem 0}.block{border-color:var(--bad);color:var(--bad)}
.tw{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:.9rem}th,td{text-align:left;padding:8px;border-bottom:1px solid var(--line);vertical-align:top}th{font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
td.n{font-family:ui-monospace,Consolas,monospace;white-space:nowrap}.q{font-size:.85rem;color:var(--muted)}summary{cursor:pointer;font-size:.8rem;color:var(--muted)}
.chip{font:700 .72rem ui-monospace,Consolas,monospace;padding:.1rem .45rem;border-radius:6px;border:1px solid var(--line);white-space:nowrap}.chip.removed,.chip.eased{color:var(--good);border-color:var(--good)}.chip.yours,.chip.shared{color:var(--warn);border-color:var(--warn)}
footer{margin-top:28px;color:var(--muted);font-size:.85rem}
</style>
</head>
<body><div class="wrap">
<div class="k">Compliance map · EU AI Act · GDPR · UK GDPR</div>
<h1>${esc(m.build)}</h1>
<p>${esc(m.system)}</p>
<p class="sub">Runs ${esc(m.deployment === 'local' ? 'on the owner\'s own machines' : m.deployment === 'cloud' ? 'on a cloud provider' : 'as a vendor\'s SaaS')} · AI: ${esc(m.ai)} · map as of ${esc(m.asOf)} · law checked ${esc(m.lawChecked)}</p>
${block}
<div class="grid"><div class="card"><div class="k">EU AI Act</div>${ai}</div><div class="card"><div class="k">GDPR / UK GDPR</div>${gd}</div><div class="card"><div class="k">Duties on this stack</div><p class="big">${m.applying} apply · ${m.inForce} in force</p><p class="sub">${m.upcoming.length ? 'Upcoming: ' + esc(m.upcoming.map((u) => u.id + ' from ' + u.from).join(', ')) : 'Nothing further scheduled.'}</p></div></div>
${m.items.length ? '<div class="card"><div class="tw"><table><thead><tr><th>Duty</th><th>On this stack</th><th>When</th></tr></thead><tbody>\n' + rows + '\n</tbody></table></div></div>' : ''}
<h2>The dates</h2>
<div class="card"><div class="tw"><table><thead><tr><th>From</th><th>What applies</th><th>Where it says so</th></tr></thead><tbody>
${dates}
</tbody></table></div></div>
<footer>Generated by the estate's compliance kernel (<a href="https://sjgant80-hub.github.io/fall-euaiact/">fall-euaiact</a>, comply.mjs) from this build's compliance.decl.json and the verified law at <a href="${esc(LAW_URL)}">law/law.json</a>. Powered by the Konomi architecture, created by Thomas Frumkin.</footer>
</div></body>
</html>
`;
}

const canonJson = (v) => JSON.stringify(v, null, 1) + '\n';

/** write(repo, asOf) — generate compliance.json and compliance.html into the build. */
export function write(repo, asOf = today()) {
  const law = loadLaw();
  const m = mapFor(repo, asOf, law);
  if (!m.ok) return m;
  writeFileSync(join(repo, 'compliance.json'), canonJson(m));
  writeFileSync(join(repo, 'compliance.html'), renderHtml(m, law));
  return { ok: true, map: m };
}

/** check(repo, today) — is the build's map present, generated (not hand-edited), current and shippable? */
export function check(repo, now = latest()) {
  const law = loadLaw();
  const problems = [];
  const jp = join(repo, 'compliance.json'), hp = join(repo, 'compliance.html');
  if (!existsSync(join(repo, 'compliance.decl.json'))) return { ok: false, problems: ['no compliance.decl.json — declare what the build does, then run: node <fall-euaiact>/tools/comply-build.mjs <repo>'] };
  if (!existsSync(jp) || !existsSync(hp)) return { ok: false, problems: ['no compliance map (compliance.json + compliance.html) — run: node <fall-euaiact>/tools/comply-build.mjs <repo>'] };
  let have;
  try { have = readJson(jp); } catch (e) { return { ok: false, problems: ['compliance.json does not parse: ' + e.message] }; }
  const asOf = have && typeof have.asOf === 'string' ? have.asOf : '';
  const m = mapFor(repo, asOf, law);
  if (!m.ok) return { ok: false, problems: ['the declaration is refused: ' + m.why] };
  if (canonJson(have) !== canonJson(m)) problems.push('compliance.json is not what the declaration and the current law generate — regenerate it (never edit it by hand)');
  if (readFileSync(hp, 'utf8').replace(/\r\n/g, '\n') !== renderHtml(m, law)) problems.push('compliance.html is not the generated page — regenerate it');
  if (asOf < law.checked) problems.push('the map is older than the law it must follow (map ' + asOf + ', law checked ' + law.checked + ') — regenerate it');
  if (days(asOf, now) > MAX_AGE_DAYS) problems.push('the map is ' + days(asOf, now) + ' days old (limit ' + MAX_AGE_DAYS + ') — regenerate it');
  if (asOf > now) problems.push('the map is dated in the future (' + asOf + ')');
  for (const b of m.blocking) problems.push('cannot ship: ' + b);
  return { ok: problems.length === 0, problems, map: m };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [repo, ...rest] = process.argv.slice(2);
  if (!repo) { console.error('usage: comply-build.mjs <repo> [--check]'); process.exit(2); }
  if (rest.includes('--check')) {
    const r = check(repo);
    if (!r.ok) { console.error('COMPLIANCE MAP FAILS:\n  ' + r.problems.join('\n  ')); process.exit(1); }
    console.log('compliance map current — AI Act: ' + (r.map.aiAct.applies ? r.map.aiAct.tier + ', ' + r.map.aiAct.role.split(' ')[0] : 'not engaged') + ' · GDPR: ' + (r.map.gdpr.applies ? 'engaged' : 'not engaged') + ' · ' + r.map.applying + ' duties (' + r.map.inForce + ' in force) · as of ' + r.map.asOf);
  } else {
    const r = write(repo);
    if (!r.ok) { console.error('NO MAP: ' + r.why); process.exit(1); }
    console.log('wrote compliance.json + compliance.html — ' + r.map.applying + ' duties, AI Act ' + (r.map.aiAct.applies ? r.map.aiAct.tier : 'not engaged') + ', GDPR ' + (r.map.gdpr.applies ? 'engaged' : 'not engaged'));
  }
}
