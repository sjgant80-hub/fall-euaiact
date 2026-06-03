# fall-euaiact

> ◊·κ=1 · EU AI Act sovereign compliance toolkit · prime 607

Single-file HTML toolkit for EU AI Act (Regulation 2024/1689) compliance. Paste your AI system description → get risk tier with article cites. Search the Act by use case. Drop in audit-trail JS for Article 12. Generate transparency badges for Article 50. Tick the Annex IV checklist.

**Live:** https://sjgant80-hub.github.io/fall-euaiact/

> Honest framing: research only, not legal advice. The risk classifier is a heuristic. For systems that materially affect anyone, get qualified legal counsel.

## Six panels

1. **Risk classifier** — paste system description → tier (Prohibited / High / Limited / Minimal) + article cites + 5 worked samples
2. **Article navigator** — 12 key articles + Annex III + penalties · search by use case
3. **Drop-in audit shim** — vanilla JS · Article 12 + SHA-256 prevHash · copy-paste into any sovereign tool
4. **Transparency badge generator** — Article 50 disclosures · 5 categories
5. **Annex IV checklist** — 14-item documentation tracker · localStorage persistence
6. **Classification log** — IndexedDB · stores every assessment · JSON export

## The four risk tiers

| Tier | What it means | What you do |
|---|---|---|
| **Prohibited (Art 5)** | banned in EU | don't deploy · re-scope |
| **High (Annex III)** | hiring · credit · education · critical infra · law enforcement | Articles 8-15 + Annex IV docs by 2 Aug 2026 |
| **Limited (Art 50)** | chatbots · deepfakes · emotion recognition | transparency disclosure (use the badge generator) |
| **Minimal** | spam filters · games · etc. | no specific AI Act obligations |

## Compliance deadlines

```
2 Feb 2025  · prohibited practices ban active
2 Aug 2025  · GPAI rules for new foundation models
2 Aug 2026  · high-risk obligations (Annex III)
2 Aug 2027  · safety-component high-risk + GPAI legacy
```

## Penalties

| Breach | Max fine |
|---|---|
| Prohibited AI (Article 5) | €35M or 7% global turnover |
| Non-compliance with high-risk obligations | €15M or 3% |
| Incorrect info to authorities | €7.5M or 1% |

## Architecture

- Single HTML file · ~1000 LOC · MIT
- Vanilla JS · no frameworks · no build step
- T0 keyword classifier · works offline · no LLM required
- IndexedDB for classification log
- localStorage for checklist persistence
- BroadcastChannel `fall-signal` for estate mesh
- Konomi licence shim baked
- PWA manifest via data: URL
- Mobile-first responsive

## Licence

MIT · Simon Gant 2026

## Sources

- Official text: [eur-lex.europa.eu/eli/reg/2024/1689/oj](https://eur-lex.europa.eu/eli/reg/2024/1689/oj)
- European AI Office: [digital-strategy.ec.europa.eu](https://digital-strategy.ec.europa.eu/en/policies/european-ai-office)

◊·κ=1 · classify · navigate · audit · disclose · document
