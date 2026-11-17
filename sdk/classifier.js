// fall-euaiact · EU AI Act risk classifier · pure functions · zero deps
// works in browser, Node 18+, Cloudflare Workers, Deno
//
// classify() is a thin adapter over kernel.js, the deterministic classifier the live page runs and the mutation
// gate proves (kernel.js is a byte copy of the repo's kernel.mjs; CI refuses any difference). There is one rule table.

import { classifyText } from './kernel.js';

export const TIERS = {
  PROHIBITED: 'prohibited',
  HIGH: 'high',
  LIMITED: 'limited',
  MINIMAL: 'minimal',
};

/**
 * T0 keyword classifier · runs offline · no LLM required
 * @param {string} description - plain-English description of the AI system
 * @returns {{ tier: string, label: string, triggers: Array, articles: Array, confidence: number }}
 */
export function classify(description) {
  if (!description || typeof description !== 'string') {
    throw new TypeError('description must be a non-empty string');
  }
  const r = classifyText(description);
  return {
    tier: r.tier,
    label: r.label,
    triggers: r.triggers.map((h) => ({ note: h.note, article: h.art })),
    articles: r.articles,
    confidence: r.confidencePct,
  };
}

const DEEP_PROMPT = `You are an EU AI Act (Regulation 2024/1689) compliance analyst. Given a description of an AI system, return a JSON object with this exact shape:

{
  "tier": "prohibited" | "high" | "limited" | "minimal",
  "confidence": 0-100,
  "articles": ["5(1)(c)", "Annex III(4)", ...],
  "reasoning": "2-4 sentences explaining the classification",
  "key_risks": ["risk 1", "risk 2", ...],
  "next_steps": ["concrete action 1", "concrete action 2", ...]
}

The tiers:
- prohibited: matches Article 5 (social scoring, predictive policing, untargeted facial scraping, workplace emotion recognition, biometric categorisation by sensitive attributes, real-time biometric ID in public for LE, subliminal manipulation, exploitation of vulnerabilities)
- high: matches Annex III (biometrics, critical infrastructure, education, employment, essential services like credit, law enforcement, migration, justice/democracy)
- limited: matches Article 50 (chatbots, deepfakes, emotion recognition outside workplace, biometric categorisation, AI-generated public-interest text)
- minimal: everything else

Be honest about confidence. If the description is ambiguous, say so in reasoning. Return ONLY the JSON object, no markdown, no preamble.`;

/**
 * T2 deep classifier · uses LLM via BYOK · returns structured JSON
 * Caller provides the apiKey · keys never leave the process boundary you control
 *
 * @param {string} description - plain-English description of the AI system
 * @param {{ provider: 'anthropic'|'openai'|'google', apiKey: string, model?: string }} opts
 * @returns {Promise<{ tier: string, confidence: number, articles: string[], reasoning: string, key_risks: string[], next_steps: string[] }>}
 */
export async function deepClassify(description, opts) {
  if (!description) throw new TypeError('description required');
  if (!opts?.provider || !opts?.apiKey) throw new TypeError('opts.provider and opts.apiKey required');

  const fetchFn = typeof fetch !== 'undefined' ? fetch : (await import('node-fetch')).default;

  if (opts.provider === 'anthropic') {
    const r = await fetchFn('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': opts.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: opts.model || 'claude-opus-5-5',
        max_tokens: 800,
        messages: [{ role: 'user', content: DEEP_PROMPT + '\n\nSystem description:\n' + description }],
      }),
    });
    const data = await r.json();
    if (data.error) throw new Error(data.error.message || 'Anthropic API error');
    return JSON.parse((data.content?.[0]?.text || '{}').replace(/^```json\s*|\s*```$/g, ''));
  }

  if (opts.provider === 'openai') {
    const r = await fetchFn('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + opts.apiKey },
      body: JSON.stringify({
        model: opts.model || 'gpt-4o-mini',
        messages: [{ role: 'system', content: DEEP_PROMPT }, { role: 'user', content: description }],
        response_format: { type: 'json_object' },
      }),
    });
    const data = await r.json();
    if (data.error) throw new Error(data.error.message || 'OpenAI API error');
    return JSON.parse(data.choices?.[0]?.message?.content || '{}');
  }

  if (opts.provider === 'google') {
    const r = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/${opts.model || 'gemini-1.5-flash'}:generateContent?key=${opts.apiKey}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: DEEP_PROMPT + '\n\nSystem description:\n' + description }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });
    const data = await r.json();
    if (data.error) throw new Error(data.error.message || 'Google AI API error');
    return JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || '{}');
  }

  throw new Error(`unknown provider: ${opts.provider}`);
}

export { DEEP_PROMPT };
