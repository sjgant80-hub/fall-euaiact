// ◊·κ=1 · fall-euaiact SDK · barrel export · MIT · zero deps
// Pure functions for EU AI Act compliance · works in browser, Node 18+, Deno, Cloudflare Workers

export { classify, deepClassify, TIERS, DEEP_PROMPT } from './classifier.js';
export { ARTICLES, ANNEX_III_CATEGORIES, PENALTIES, DEADLINES, searchArticles, getArticle, articlesForTier } from './articles.js';
export { createAuditShim } from './audit.js';
export { generateAnnexIV, getDocFields, validateValues, DOC_FIELDS } from './docgen.js';

export const SDK_VERSION = '1.0.0';
export const SPEC_VERSION = 'Regulation (EU) 2024/1689';
