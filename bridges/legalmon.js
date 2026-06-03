// ◊·κ=1 · fall-euaiact ↔ Legalmon bridge · zero deps
// Translates EU AI Act classifications into Pokemon-style battle configs
//
// Legalmon (teslasolar/Legalmon) is Thomas's "Pokemon-style court case battle replay"
// This bridge maps an AI Act classification to a battle:
//   - YOU (your AI system) = your "Pokemon" · stats from the system description
//   - OPPONENT = the regulator · stats from tier severity + article count
//   - MOVES = the Articles cited (each becomes a "move" with type/power)
//   - WIN CONDITION = clear compliance with all cited articles
//
// The output JSON is the contract Thomas's Legalmon can consume.

import { articlesForTier } from '../sdk/articles.js';

/**
 * Build a Legalmon battle config from an EU AI Act classification.
 *
 * @param {ClassifyResult|DeepClassifyResult} verdict
 * @param {string} systemName - the user's system name (or 'Your AI System')
 * @returns {object} Legalmon battle config
 */
export function toLegalmonBattle(verdict, systemName) {
  const tier = verdict.tier || 'minimal';
  const articles = verdict.articles || [];
  const tierMeta = TIER_META[tier];

  return {
    battle_id: `euaia-${tier}-${Date.now()}`,
    title: `${systemName || 'Your AI System'} vs EU AI Office`,
    arena: tierMeta.arena,
    music: tierMeta.music,
    your_pokemon: {
      name: systemName || 'Your AI System',
      type: tierMeta.your_type,
      hp: tierMeta.your_hp,
      sprite_hint: tierMeta.your_sprite,
      moves: articles.map(art => articleAsMove(art)),
      ability: tierMeta.your_ability,
    },
    opponent_pokemon: {
      name: tierMeta.opponent_name,
      type: 'Regulator',
      hp: tierMeta.opponent_hp,
      sprite_hint: tierMeta.opponent_sprite,
      moves: tierMeta.opponent_moves,
      ability: tierMeta.opponent_ability,
    },
    win_condition: {
      type: 'compliance',
      requires_all: articles,
      reward: tierMeta.reward,
    },
    lose_condition: {
      type: 'enforcement',
      penalty: tierMeta.penalty,
    },
    referee_quote: tierMeta.quote,
    metadata: {
      source: 'fall-euaiact',
      spec: 'Regulation (EU) 2024/1689',
      classification_confidence: verdict.confidence,
      triggers: verdict.triggers || [],
    },
  };
}

const TIER_META = {
  prohibited: {
    arena: 'Brussels Tribunal · Article 5 Forbidden Zone',
    music: 'epic_doom_tribunal',
    your_type: 'Shadow',
    your_hp: 30,
    your_sprite: 'shadowy_glitched',
    your_ability: 'Forbidden Aura',
    opponent_name: 'EU AI Office · Enforcement Squad',
    opponent_hp: 200,
    opponent_sprite: 'enforcement_judge_with_gavel',
    opponent_moves: ['Article 5 Strike (35M dmg)', 'Cease & Desist Beam', 'Member State Coordination', '7%-of-Turnover Smash'],
    opponent_ability: 'Absolute Prohibition',
    reward: 'None · this system cannot be deployed in the EU',
    penalty: '€35M or 7% global turnover (whichever higher)',
    quote: 'The Article 5 prohibition is absolute. Re-scope your system.',
  },
  high: {
    arena: 'Annex III Battle Stadium · Notified Body in the bleachers',
    music: 'epic_compliance_arena',
    your_type: 'High-Risk',
    your_hp: 100,
    your_sprite: 'serious_briefcase_carrying',
    your_ability: 'Documentation Resilience',
    opponent_name: 'EU AI Office · High-Risk Reviewer',
    opponent_hp: 150,
    opponent_sprite: 'auditor_with_checklist',
    opponent_moves: ['Annex IV Demand', 'Risk Management Audit', '6-Month Log Inspection', 'Conformity Challenge'],
    opponent_ability: 'Burden on Provider',
    reward: 'CE marking · EU Declaration of Conformity · market access',
    penalty: '€15M or 3% global turnover',
    quote: 'Pass the conformity assessment. Document everything. Article 14 is non-negotiable.',
  },
  limited: {
    arena: 'Article 50 Disclosure Beach · Friendly Surf',
    music: 'chill_compliance_lofi',
    your_type: 'Transparent',
    your_hp: 120,
    your_sprite: 'cheerful_with_badge',
    your_ability: 'User Notice',
    opponent_name: 'EU AI Office · Light Touch Inspector',
    opponent_hp: 60,
    opponent_sprite: 'friendly_clipboard',
    opponent_moves: ['Badge Check', 'Disclosure Audit', 'User Clarity Test'],
    opponent_ability: 'Lightweight Enforcement',
    reward: 'Compliance achieved · keep deploying with the badge visible',
    penalty: 'Order to add disclosure · usually no fine first offence',
    quote: 'Add the transparency badge. The Article 50 surf is gentle if you respect it.',
  },
  minimal: {
    arena: 'Minimal Risk Park · Picnic Area',
    music: 'peaceful_meadow',
    your_type: 'Normal',
    your_hp: 200,
    your_sprite: 'happy_picnic',
    your_ability: 'No Specific Obligations',
    opponent_name: 'Voluntary Code Volunteer',
    opponent_hp: 30,
    opponent_sprite: 'helpful_advisor',
    opponent_moves: ['Good Practice Tip', 'Voluntary Guideline'],
    opponent_ability: 'Friendly Reminder',
    reward: 'No specific AI Act obligations · keep doing what you do',
    penalty: 'None under AI Act (other EU law still applies)',
    quote: 'Minimal risk. The Act lets you breathe. GDPR and sectoral rules still apply.',
  },
};

function articleAsMove(articleRef) {
  return {
    name: `Article ${articleRef}`,
    type: 'Compliance',
    power: powerFromArticle(articleRef),
    accuracy: 100,
    description: `Cite Article ${articleRef} in the technical documentation.`,
  };
}

function powerFromArticle(ref) {
  if (ref.startsWith('5')) return 100;      // prohibited · max damage
  if (ref.startsWith('Annex III')) return 80;
  if (ref.startsWith('50')) return 40;
  return 30;
}

/**
 * Emit a fall-signal event that Legalmon can pick up.
 * Legalmon listens on the same BroadcastChannel and renders the battle.
 *
 * @param {object} bc - BroadcastChannel('fall-signal') instance
 * @param {ClassifyResult|DeepClassifyResult} verdict
 * @param {string} systemName
 */
export function emitToLegalmon(bc, verdict, systemName) {
  if (!bc) return false;
  try {
    bc.postMessage({
      type: 'fall_signal',
      source: 'fall-euaiact',
      target: 'legalmon',
      kind: 'euaia_battle_request',
      payload: toLegalmonBattle(verdict, systemName),
      ts: new Date().toISOString(),
    });
    return true;
  } catch (_) {
    return false;
  }
}
