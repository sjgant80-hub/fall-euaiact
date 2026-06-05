# fall-euaiact / cdn

Drop-in CDN shim that satisfies **EU AI Act Article 12** record-keeping in any
sovereign single-file HTML tool · zero deps · SHA-256 prevHash chain · IndexedDB.

## one-line integration

```html
<script src="https://sjgant80-hub.github.io/fall-euaiact/cdn/audit-shim.js"
        data-tool="fallcrm"
        data-tier="minimal"></script>
```

After load:

```js
// auto-bootstrapped at: window.__audit
await window.__audit.log({
  type: 'classify',
  input: 'CV scoring request',
  output: 'HIGH RISK · Annex III §4',
  operator: 'session-abc'
});

// auditor walks in · proves nothing was tampered with
const proof = await window.__audit.verifyChain();
console.log(proof); // { valid: true, total: 142 }
```

## what it gives you

| Article | What it covers | What this shim does |
|---|---|---|
| **Art 12** | automatic event logging over system lifetime | every `log()` call appends to an IndexedDB chain |
| **Art 12(2)** | events material to risk identification | log type/input/output/operator + metadata |
| **Art 12(3)** | tamper-evident records | SHA-256 prevHash chain · `verifyChain()` proves integrity |
| **Art 26(6)** | 6-month retention by deployers | data persists in browser IndexedDB until explicitly cleared |

## tier tags

The `data-tier` attribute should match the system's EU AI Act risk classification:

| Tier | Use when |
|---|---|
| `prohibited` | should not be deployed — Article 5 list |
| `high` | Annex III categories · employment / credit / law / education / biometrics |
| `limited` | chatbots · generates content shown to humans · Article 50 disclosure required |
| `minimal` | calculators · schedulers · tools · default |

If you're unsure, classify your tool at https://sjgant80-hub.github.io/fall-euaiact/

## mesh handshake

On bootstrap, the shim emits `euaiact:ready` on `BroadcastChannel('fall-signal')` —
every Fall* tool in the mesh now knows this tool is Article 12 compliant:

```js
new BroadcastChannel('fall-signal').onmessage = e => {
  if (e.data.kind === 'euaiact:ready') {
    console.log(`${e.data.source} compliant · tier=${e.data.payload.tier}`);
  }
};
```

## what it does NOT do

- **Not legal advice.** Engage counsel for your specific deployment.
- **Not signed audit.** This is tamper-evident, not non-repudiable. For non-repudiation,
  pair with the Konomi licence shim (Ed25519) — same estate.
- **Not synced.** Records stay in this browser. Multi-device / regulator handover
  is via `exportAll()` → JSON / CSV.

## verifying integrity

```js
const result = await window.__audit.verifyChain();
// { valid: true, total: 142 }
// or { valid: false, broken_at: 47, total: 142, reason: 'hash mismatch' }
```

If `valid: false`, an entry was tampered with after creation. Article 12 satisfied
by the chain itself — you can produce the proof on demand.

## licence

MIT · use freely in sovereign tools or commercial products.

---

◊·κ=1 · prime 607 · fall-euaiact
