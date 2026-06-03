// ◊·κ=1 · fall-euaiact ↔ FallBrief bridge · zero deps
// Translates EU AI Act classifications into FallBrief weave queries
//
// FallBrief is Simon's sovereign legal research tool (single HTML · IndexedDB · WebLLM)
// with 9 agents: MAGNA · LIBERTY · CROWN · EQUITY · HEARTH · GUILD · ADMIRALTY · PROCEDURE · BRUSSELS (new)
//
// This bridge:
//   1. Maps fall-euaiact classifications to FallBrief weave queries
//   2. Emits fall-signal events FallBrief can consume
//   3. Provides a FallBrief-compatible weave registration helper

import { ARTICLES, articlesForTier } from '../sdk/articles.js';

/**
 * Map an EU AI Act classification to a FallBrief query payload.
 * FallBrief's BRUSSELS agent (added by this bridge) reads this shape.
 *
 * @param {ClassifyResult|DeepClassifyResult} verdict - output of classify() or deepClassify()
 * @param {string} systemDescription - original system description
 * @returns {object} FallBrief query payload
 */
export function toFallBriefQuery(verdict, systemDescription) {
  const tier = verdict.tier;
  const articles = verdict.articles || [];
  const relevantArticles = articlesForTier(tier);

  return {
    agent: 'BRUSSELS',                              // the new agent · EU AI law
    domain: 'EU AI Act · Regulation 2024/1689',
    query_type: 'compliance_classification',
    tier,
    system_description: systemDescription,
    confidence: verdict.confidence,
    articles_to_research: articles,
    related_articles: relevantArticles.map(a => a.id),
    triggers: verdict.triggers || [],
    reasoning: verdict.reasoning || verdict.label,
    weave_hints: weaveHintsForTier(tier),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Weave-style hints that map to FallBrief's strategic move pattern.
 * Each tier has different argument shapes the BRUSSELS agent should consider.
 */
function weaveHintsForTier(tier) {
  if (tier === 'prohibited') {
    return [{
      id: 'EUAIA-001',
      name: 'The Article 5 Prohibition',
      archetype: 'Where the AI system performs one of the eight Article 5 prohibited practices',
      move: 'Establish (a) the practice falls within Article 5(1) categories · (b) no exception applies · (c) provider/deployer is in the EU OR placing on the EU market',
      authorities: ['Reg. (EU) 2024/1689 Art. 5', 'Recital 28-44'],
      counter: 'No public-interest exception narrows Article 5(1)(h) for real-time biometric in public · narrow grounds only',
      why_it_wins: 'Absolute prohibition · no balancing test · enforcement from 2 Feb 2025',
    }];
  }
  if (tier === 'high') {
    return [{
      id: 'EUAIA-002',
      name: 'The Article 6 + Annex III Wedge',
      archetype: 'Where the AI system performs an Annex III function · employment, credit, education, etc.',
      move: 'Establish (a) the system is intended for Annex III use · (b) no Article 6(3) carveout applies · (c) trigger Articles 8-15 obligations',
      authorities: ['Reg. (EU) 2024/1689 Art. 6 + Annex III', 'Art. 8-15'],
      opposition_move: 'Argue the system is purely procedural / preparatory under Art. 6(3)',
      counter: 'Show the system materially affects the outcome of decisions on natural persons · 6(3) does not apply',
      why_it_wins: 'Annex III is presumptively high-risk · burden on provider to prove carveout',
    }, {
      id: 'EUAIA-003',
      name: 'The Article 14 Oversight Gate',
      archetype: 'Where compliance with human-oversight requires a stop/intervene mechanism',
      move: 'Document the natural-person reviewer + the technical interruption capability + automation-bias mitigation',
      authorities: ['Reg. (EU) 2024/1689 Art. 14'],
      why_it_wins: 'Sovereign tools with pause-before-action gates are Art. 14 compliant by design',
    }];
  }
  if (tier === 'limited') {
    return [{
      id: 'EUAIA-004',
      name: 'The Article 50 Disclosure',
      archetype: 'Where AI interaction · emotion recognition · biometric categorisation · or AI-generated content requires user notice',
      move: 'Establish the disclosure is (a) clear · (b) at time of interaction · (c) machine-readable for downstream',
      authorities: ['Reg. (EU) 2024/1689 Art. 50'],
      why_it_wins: 'Lightweight obligation · the badge generator output satisfies it',
    }];
  }
  return [];
}

/**
 * Emit a fall-signal event that FallBrief can pick up.
 * FallBrief listens on the same BroadcastChannel and routes the event to the BRUSSELS agent.
 *
 * @param {object} bc - BroadcastChannel('fall-signal') instance
 * @param {ClassifyResult|DeepClassifyResult} verdict
 * @param {string} systemDescription
 */
export function emitToFallBrief(bc, verdict, systemDescription) {
  if (!bc) return false;
  try {
    bc.postMessage({
      type: 'fall_signal',
      source: 'fall-euaiact',
      target: 'fallbrief',
      kind: 'euaia_classification',
      payload: toFallBriefQuery(verdict, systemDescription),
      ts: new Date().toISOString(),
    });
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Helper FallBrief itself imports to register the BRUSSELS agent.
 * Drop this into FallBrief's agent registry.
 *
 * @returns {object} BRUSSELS agent definition for FallBrief
 */
export function brusselsAgentDef() {
  return {
    name: 'BRUSSELS',
    domain: 'EU AI Act · Regulation 2024/1689',
    role: 'EU AI law specialist · risk classification · Annex IV documentation',
    accepts: ['euaia_classification', 'euaia_article_query', 'euaia_doc_request'],
    description: 'Reads classifications from fall-euaiact and produces strategic compliance arguments using the Article 5 / Annex III / Article 50 weave patterns.',
    weave_prefix: 'EUAIA-',
    authorities: ARTICLES.map(a => ({ ref: a.title, summary: a.summary })),
  };
}
