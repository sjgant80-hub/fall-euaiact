# fall-euaiact SDK

> EU AI Act compliance SDK · zero deps · MIT · v1.2.0

JavaScript SDK for EU AI Act (Regulation 2024/1689) compliance. Pure functions. Zero dependencies. Works in browser, Node 18+, Cloudflare Workers, Deno.

```bash
npm install github:sjgant80-hub/fall-euaiact-sdk
```

It is not on the npm registry: it installs straight from the [fall-euaiact-sdk](https://github.com/sjgant80-hub/fall-euaiact-sdk) repository, which carries this folder. Live page with the API reference and a try-it panel: https://sjgant80-hub.github.io/fall-euaiact-sdk/

## Quick start

### Classify a system

```js
import { classify } from '@ai-native-solutions/fall-euaiact-sdk';

const result = classify('An AI system that screens CVs for a recruitment agency.');
// {
//   tier: 'high',
//   label: 'HIGH RISK · Annex III · Articles 6-15',
//   triggers: [{ note: 'employment · CV screening · hiring', article: 'Annex III(4)' }],
//   articles: ['Annex III(4)'],
//   confidence: 60
// }
```

### Deep classify via LLM (BYOK)

```js
import { deepClassify } from '@ai-native-solutions/fall-euaiact-sdk';

const result = await deepClassify(systemDescription, {
  provider: 'anthropic', // or 'openai' or 'google'
  apiKey: process.env.ANTHROPIC_API_KEY,
});
// {
//   tier: 'high',
//   confidence: 92,
//   articles: ['Annex III(4)', 'Article 14', 'Article 9'],
//   reasoning: '...',
//   key_risks: [...],
//   next_steps: [...]
// }
```

### Navigate the Act

```js
import { searchArticles, getArticle, articlesForTier, ARTICLES, DEADLINES, PENALTIES } from '@ai-native-solutions/fall-euaiact-sdk';

searchArticles('hiring');                  // → [Article 5, Annex III, etc. matches]
getArticle('14');                          // → Article 14 (Human oversight)
articlesForTier('high');                   // → [Article 6, 9, 10, 11, 12, 13, 14, 15, 26]
ARTICLES;                                  // → all 12 key articles
DEADLINES;                                 // → enforcement timeline
PENALTIES;                                 // → max fines per breach
```

### Article 12 audit shim (cryptographic log chain)

```js
import { createAuditShim } from '@ai-native-solutions/fall-euaiact-sdk';

const audit = createAuditShim({ dbName: 'my-app-audit', sink: 'indexeddb' });
// or sink: 'memory' for Node / Workers

await audit.log({
  type: 'inference',
  input: 'user query text',
  output: 'system response',
  operator: 'user-123',
});

// Article 26 6-month retention export
const allEntries = await audit.exportAll();

// Verify tamper-evidence
const { valid, total } = await audit.verifyChain();
```

### Generate Annex IV documentation

```js
import { generateAnnexIV, getDocFields, validateValues } from '@ai-native-solutions/fall-euaiact-sdk';

const values = {
  system_name: 'FallVet CV Scorer v2.3',
  provider: 'Acme GmbH · 10 Musterstraße, Berlin',
  purpose: 'Scoring software-engineer CVs...',
  // ... 14 fields total · see getDocFields()
};

const missing = validateValues(values);
// → array of missing field ids

const markdown = generateAnnexIV(values, { date: '2026-06-03' });
// → full Annex IV-structured Markdown ready to download
```

## REST API (self-host)

A reference Cloudflare Worker is included (`worker.js`). Deploy it yourself for a sovereign REST endpoint:

```bash
# Cloudflare Workers
npx wrangler init my-euaiact-api
# copy worker.js + classifier.js + articles.js + docgen.js into src/
npx wrangler publish
```

Endpoints:

```
POST /v1/classify              → ClassifyResult
POST /v1/deep-classify         → DeepClassifyResult (BYOK pass-through)
GET  /v1/articles?q=hiring     → Article[]
GET  /v1/article/:id           → Article
POST /v1/docgen                → { markdown }
GET  /v1/spec                  → SDK + spec metadata
```

Full OpenAPI 3.1 spec in `openapi.yaml`.

## Subpath imports

Tree-shake friendly · import only what you need:

```js
import { classify } from '@ai-native-solutions/fall-euaiact-sdk/classifier';
import { ARTICLES } from '@ai-native-solutions/fall-euaiact-sdk/articles';
import { createAuditShim } from '@ai-native-solutions/fall-euaiact-sdk/audit';
import { generateAnnexIV } from '@ai-native-solutions/fall-euaiact-sdk/docgen';
```

## TypeScript

Types included (`index.d.ts`). Full type coverage for all exports.

## What this SDK does NOT do

- It does NOT give legal advice. The classifier is a heuristic. Get qualified counsel for systems that materially affect anyone.
- It does NOT host your API. You deploy the worker yourself · sovereign by design.
- It does NOT translate the Act. UI strings can be localised (6 languages in the demo) but article text stays in English with links to the official EUR-Lex translations (all 24 EU languages).
- It does NOT replace the technical documentation that a Notified Body may want to see. The doc generator produces a starting draft.

## Honest caveats

- The classifier is keyword-pattern matching. Sophisticated systems need real legal review.
- The Act is being interpreted by national authorities · interpretations evolve until at least 2027.
- For high-risk systems · real conformity assessment may require a Notified Body depending on category.

## The interactive demo

The live page at https://sjgant80-hub.github.io/fall-euaiact/ runs the same classifier: `kernel.js` here is a byte copy of the page's gated `kernel.mjs` (the build fails on any difference), and `classify()` is a thin adapter over it. Signing uses the platform's WebCrypto Ed25519; nothing is fetched at runtime.

## Licence

MIT · Simon Gant 2026

## Sources

- Official text: [eur-lex.europa.eu/eli/reg/2024/1689/oj](https://eur-lex.europa.eu/eli/reg/2024/1689/oj)
- European AI Office: [digital-strategy.ec.europa.eu](https://digital-strategy.ec.europa.eu/en/policies/european-ai-office)

classify · navigate · audit · disclose · document
