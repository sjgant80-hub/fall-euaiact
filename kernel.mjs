// fall-euaiact · kernel.mjs — the deterministic EU AI Act risk classifier, extracted from the page
// and gated. Given a plain-English system description, it returns the most-likely risk tier
// (prohibited > high > limited > minimal) with the article cites to read, and seals a
// content-addressed assessment so a verdict can be verified and shown to have not been altered.
//
// PURE and TOTAL: no DOM, no I/O, no throw on garbage. Heuristic by design — a starting point
// grounded in Regulation 2024/1689, not a definitive legal judgment (the page says so too). The
// non-deterministic LLM "deep classify" path stays OUT of this kernel; only the deterministic
// keyword classifier is gated, because only the deterministic part can be proven.

export const TIERS = Object.freeze(['prohibited', 'high', 'limited', 'minimal']);

const isStr = (v) => typeof v === 'string';
const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

// The example systems the page ships — kept here so the page, the tests, and the gate share one source.
export const SAMPLES = Object.freeze([
  "An AI system that screens CVs for a recruitment agency. Takes uploaded CVs, scores each candidate 0-100 against the job description, ranks them, and rejects the bottom 50% automatically without human review.",
  "A customer support chatbot on an e-commerce website. Handles FAQs, order status, returns. Hands off to a human agent for complex issues. Discloses it's AI in the opening message.",
  "An AI scoring credit applications for a consumer lender. Combines income, employment, credit history, behavioural data to produce an approval/decline + suggested interest rate.",
  "A social scoring system for citizens that aggregates online behaviour, financial conduct, and social network activity into a single trust score that determines access to government services.",
  "An email spam filter that classifies incoming emails as spam or legit using bag-of-words and logistic regression. Falls back to a heuristic rule set when the model is uncertain.",
]);

// The rules, in strict priority order. The FIRST tier with any matching trigger wins — so a
// prohibited use is never softened to high just because it also trips a high trigger.
export const RULES = [
  { tier: 'prohibited', label: 'PROHIBITED · Article 5', triggers: [
    { re: /social scor|citizen scor|trust score.*citizen/i, art: '5(1)(c)', note: 'social scoring by public authorities' },
    { re: /predictive polic|assess.*risk.*committ.*crim/i, art: '5(1)(d)', note: 'predictive policing on individuals' },
    { re: /scrap.*facial|facial.*scrap.*CCTV/i, art: '5(1)(e)', note: 'untargeted scraping for facial recognition' },
    { re: /emotion recognition.*workplace|emotion.*employee|emotion.*school/i, art: '5(1)(f)', note: 'emotion recognition in workplace/education' },
    { re: /biometric categor.*(?:race|religion|political|sexual)/i, art: '5(1)(g)', note: 'biometric categorisation by sensitive attributes' },
    { re: /real.?time.*biometric.*public|real.?time.*facial.*recogn.*public/i, art: '5(1)(h)', note: 'real-time remote biometric ID in public for LE' },
    { re: /subliminal|manipulat.*behaviour.*harm/i, art: '5(1)(a)', note: 'subliminal/manipulative techniques causing harm' },
    { re: /exploit.*vulnerab.*(?:age|disability|economic)/i, art: '5(1)(b)', note: 'exploitation of vulnerabilities' },
  ] },
  { tier: 'high', label: 'HIGH RISK · Annex III · Articles 6-15', triggers: [
    { re: /\b(cv|c\.v\.|resume|résumé)s?\b.{0,30}(screen|scor|rank|filter|reject)|screen.{0,30}\b(cv|c\.v\.|resume|résumé)s?\b|hire.*decision|hir.*algorithm|recruit.*(automat|agency|agent)|applicant.*scor/i, art: 'Annex III(4)', note: 'employment · CV screening · hiring' },
    { re: /performance evaluat|worker.*manag|task allocat.*algorithm|monitor.*employee/i, art: 'Annex III(4)', note: 'workplace performance evaluation' },
    { re: /credit.{0,20}(scoring|decision|approval|application|review|risk)|scor.{0,20}credit|loan.*decision|underwrit/i, art: 'Annex III(5)', note: 'access to essential financial services' },
    { re: /insurance.*pric|health.*insurance.*risk/i, art: 'Annex III(5)', note: 'insurance underwriting · health/life' },
    { re: /emergency.*dispatch|triage.*emerg/i, art: 'Annex III(5)', note: 'emergency service dispatch' },
    { re: /public benefit.*eligib|welfare.*decis|social.*assistance.*decis/i, art: 'Annex III(5)', note: 'eligibility for public benefits' },
    { re: /student.*admiss|exam.*scor.*automat|cheating detect.*exam/i, art: 'Annex III(3)', note: 'education · admissions/scoring/cheating' },
    { re: /critical infrastruct|grid.*manag|water.*manag.*AI|gas.*pipeline.*AI/i, art: 'Annex III(2)', note: 'critical infrastructure management' },
    { re: /law enforcement.*evid|criminal.*profil|crime.*analyt|polic.*risk.*assess/i, art: 'Annex III(6)', note: 'law enforcement (non-prohibited categories)' },
    { re: /migrat.*assess|asylum.*decis|border.*control.*AI|visa.*decis.*algorithm/i, art: 'Annex III(7)', note: 'migration / asylum / border control' },
    { re: /judicial.*decis|court.*ruling.*assist|democratic.*process.*influence/i, art: 'Annex III(8)', note: 'administration of justice / democracy' },
    { re: /biometric.*identif(?!.*public)|fingerprint.*match|face.*verif|voice.*identif/i, art: 'Annex III(1)', note: 'biometric identification (non-prohibited)' },
  ] },
  { tier: 'limited', label: 'LIMITED RISK · Article 50 transparency', triggers: [
    { re: /chatbot|customer support.*AI|conversation.*assistant|virtual.*agent/i, art: '50(1)', note: 'chatbot · disclose AI to user' },
    { re: /deepfake|synthetic.*video|generated.*image|AI.*generated.*content|content.*manipulat/i, art: '50(4)', note: 'deepfake / AI-generated content disclosure' },
    { re: /emotion recognition(?!.*workplace)/i, art: '50(3)', note: 'emotion recognition (outside workplace) disclosure' },
    { re: /biometric categor/i, art: '50(3)', note: 'biometric categorisation disclosure' },
    { re: /AI.*generated.*text.*(?:news|public|article)/i, art: '50(4)', note: 'AI-generated public interest text disclosure' },
  ] },
];

const MINIMAL = Object.freeze({ tier: 'minimal', label: 'MINIMAL RISK · default tier' });

/**
 * Classify a system description into a risk tier. Runs the rules in priority order and stops at the
 * FIRST tier that matches — prohibited before high before limited — then reports only that tier's
 * hits. No match anywhere → minimal. Confidence rises with the number of triggers, capped at 95.
 */
export function classifyText(text) {
  const t = isStr(text) ? text : '';
  const hits = [];
  let bestTier = MINIMAL.tier, bestLabel = MINIMAL.label;
  for (const tier of RULES) {
    for (const trig of tier.triggers) {
      if (trig.re.test(t)) hits.push({ tier: tier.tier, note: trig.note, art: trig.art });
    }
    if (hits.some((h) => h.tier === tier.tier)) { bestTier = tier.tier; bestLabel = tier.label; break; }
  }
  const tierHits = hits.filter((h) => h.tier === bestTier);
  const articles = [...new Set(tierHits.map((h) => h.art))];
  const confidencePct = tierHits.length === 0 ? 0 : Math.min(95, 40 + tierHits.length * 20);
  return { tier: bestTier, label: bestLabel, triggers: tierHits.map((h) => ({ note: h.note, art: h.art })), articles, matched: tierHits.length, confidencePct };
}

/** The obligation summary for a tier — what you must actually do, and from when it applies. The dates are Art 113
 *  as amended by the Digital Omnibus on AI (Regulation (EU) 2026/1744, in force 27 July 2026): Article 5 from
 *  2 February 2025, Article 50 from 2 August 2026, the high-risk regime for Annex III systems from 2 December 2027. */
export function obligationsFor(tier) {
  if (!TIERS.includes(tier)) return { ok: false, why: 'tier must be one of ' + TIERS.join(', ') };
  if (tier === 'prohibited') return { ok: true, tier, deadline: '2025-02-02', articles: ['5'], action: 'Prohibited in the EU since 2 February 2025. Do not deploy: re-scope the use case or remove the prohibited element.' };
  if (tier === 'high') return { ok: true, tier, deadline: '2027-12-02', articles: ['8-15', '26', 'Annex IV'], action: 'The high-risk regime applies to Annex III systems from 2 December 2027 (Art 113 as amended by Regulation (EU) 2026/1744). Meet Articles 8-15, Article 26 (deployer obligations) and the Annex IV documentation by then.' };
  if (tier === 'limited') return { ok: true, tier, deadline: '2026-08-02', articles: ['50'], action: 'Article 50 transparency applies from 2 August 2026: tell people they are dealing with an AI system, and mark generated content machine-readably (systems already on the market before then: by 2 December 2026).' };
  return { ok: true, tier: 'minimal', deadline: null, articles: [], action: 'No specific AI Act obligations beyond AI literacy (Art 4) and voluntary codes. Other EU law (GDPR, product safety, sectoral rules) still applies.' };
}

/** The date a tier's AI Act obligations apply from (Art 113 as amended by Regulation (EU) 2026/1744). */
export function deadlineFor(tier) {
  if (tier === 'prohibited') return '2025-02-02';
  if (tier === 'high') return '2027-12-02';
  if (tier === 'limited') return '2026-08-02';
  return null;
}

// ── SHA-256 + canonical JSON (the estate's proven pair, verbatim) ───────────────────────────────
const K256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export function sha256(text) {
  if (!isStr(text)) return { ok: false, why: 'sha256 takes a string' };
  const data = new TextEncoder().encode(text);
  const len = data.length;
  const padded = new Uint8Array((((len + 8) >> 6) << 6) + 64);
  padded.set(data);
  padded[len] = 0x80;
  const dv = new DataView(padded.buffer);
  const bitLen = len * 8;
  dv.setUint32(padded.length - 8, Math.floor(bitLen / 4294967296));
  dv.setUint32(padded.length - 4, bitLen >>> 0);
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const w = new Uint32Array(64);
  for (let i = 0; i < padded.length; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = dv.getUint32(i + t * 4);
    for (let t = 16; t < 64; t++) {
      const x = w[t - 15], y = w[t - 2];
      const s0 = (((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3)) >>> 0;
      const s1 = (((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10)) >>> 0;
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, hh = h7;
    for (let t = 0; t < 64; t++) {
      const S1 = (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const t1 = (hh + S1 + ch + K256[t] + w[t]) >>> 0;
      const S0 = (((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + hh) >>> 0;
  }
  const hex = (n) => n.toString(16).padStart(8, '0');
  return { ok: true, hash: hex(h0) + hex(h1) + hex(h2) + hex(h3) + hex(h4) + hex(h5) + hex(h6) + hex(h7) };
}

export function canon(v) {
  if (v === null || typeof v === 'number' || typeof v === 'boolean') return JSON.stringify(v);
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  return '"?"';
}

/**
 * Seal an assessment: the tier + articles + a hash of the exact text, content-addressed. The
 * verdict becomes a tamper-evident artifact — change the text or the tier and the hash no longer
 * matches. This is the provable upgrade: even the compliance verdict can be checked, not trusted.
 */
export function assess(text, meta) {
  const c = classifyText(text);
  const th = sha256(isStr(text) ? text : '');
  const body = {
    v: 1, kind: 'euaiact-assessment',
    tier: c.tier, articles: c.articles, matched: c.matched, confidencePct: c.confidencePct,
    textHash: th.hash, at: (isObj(meta) && isStr(meta.at)) ? meta.at : null,
    scope: 'a deterministic, heuristic risk-tier assessment against Regulation 2024/1689 — a documented starting point, not a definitive legal judgment',
  };
  const h = sha256(canon(body));
  return { ...body, hash: h.hash };
}

export function verifyAssessment(a) {
  if (!isObj(a) || !isStr(a.hash)) return { ok: false, why: 'an assessment is an object with a hash' };
  if (a.kind !== 'euaiact-assessment') return { ok: false, why: 'not a euaiact assessment' };
  const body = { ...a };
  delete body.hash;
  const h = sha256(canon(body));
  if (!h.ok) return { ok: false, why: h.why };
  return { ok: true, valid: h.hash === a.hash };
}

export default classifyText;
