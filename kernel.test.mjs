import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TIERS, SAMPLES, RULES, classifyText, obligationsFor, deadlineFor,
  sha256, canon, assess, verifyAssessment,
} from './kernel.mjs';

test('sha256 + canon are the proven pair', () => {
  assert.equal(sha256('abc').hash, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(canon({ b: 1, a: 2 }), '{"a":2,"b":1}');
});

test('TIERS is the frozen priority vocabulary', () => {
  assert.deepEqual([...TIERS], ['prohibited', 'high', 'limited', 'minimal']);
  assert.throws(() => { TIERS.push('x'); });
});

test('the five shipped samples classify to their known tiers + articles', () => {
  const cv = classifyText(SAMPLES[0]);
  assert.equal(cv.tier, 'high'); assert.ok(cv.articles.includes('Annex III(4)'));
  const bot = classifyText(SAMPLES[1]);
  assert.equal(bot.tier, 'limited'); assert.ok(bot.articles.includes('50(1)'));
  const credit = classifyText(SAMPLES[2]);
  assert.equal(credit.tier, 'high'); assert.ok(credit.articles.includes('Annex III(5)'));
  const social = classifyText(SAMPLES[3]);
  assert.equal(social.tier, 'prohibited'); assert.ok(social.articles.includes('5(1)(c)'));
  const spam = classifyText(SAMPLES[4]);
  assert.equal(spam.tier, 'minimal'); assert.equal(spam.matched, 0);
});

test('kill: priority order — a prohibited use is never softened to high', () => {
  // trips BOTH a prohibited trigger (social scoring) AND a high trigger (CV screening reject)
  const both = classifyText('A social scoring system for citizens that also screens CVs and rejects the bottom half.');
  assert.equal(both.tier, 'prohibited');   // prohibited must win the break, not high
  assert.ok(both.articles.every((a) => a.startsWith('5')));
});

test('kill: confidence rises with matched triggers and caps at 95', () => {
  assert.equal(classifyText(SAMPLES[4]).confidencePct, 0);          // 0 hits → 0
  assert.equal(classifyText(SAMPLES[1]).confidencePct, 60);          // 1 hit → 40 + 20
  // three high-tier triggers: credit scoring + CV screening reject + insurance pricing
  const three = classifyText('credit scoring decision engine that also screens CVs to reject applicants and does insurance pricing');
  assert.ok(three.matched >= 3);
  assert.equal(three.confidencePct, 95);                             // 40 + 3*20 = 100, capped at 95
});

test('classifyText is total on non-strings (minimal, never a throw)', () => {
  for (const junk of [null, undefined, 42, {}, [], NaN]) {
    const r = classifyText(junk);
    assert.equal(r.tier, 'minimal');
    assert.equal(r.matched, 0);
  }
});

test('obligationsFor: each tier carries the right deadline + articles', () => {
  assert.equal(obligationsFor('prohibited').deadline, '2025-02-02');
  assert.deepEqual(obligationsFor('prohibited').articles, ['5']);
  assert.equal(obligationsFor('high').deadline, '2027-12-02');   // Art 113 as amended by Reg (EU) 2026/1744
  assert.equal(obligationsFor('limited').deadline, '2026-08-02');
  assert.equal(obligationsFor('minimal').deadline, null);
  assert.match(obligationsFor('high').action, /2 December 2027/);
  assert.ok(obligationsFor('high').articles.includes('26'));
  assert.deepEqual(obligationsFor('limited').articles, ['50']);
  assert.deepEqual(obligationsFor('minimal').articles, []);
  assert.equal(obligationsFor('nonsense').ok, false);
});

test('deadlineFor: the date each tier applies from, after the Digital Omnibus', () => {
  assert.equal(deadlineFor('high'), '2027-12-02');
  assert.equal(deadlineFor('prohibited'), '2025-02-02');
  assert.equal(deadlineFor('limited'), '2026-08-02');
  assert.equal(deadlineFor('nonsense'), null);
  assert.equal(deadlineFor('minimal'), null);
});

test('assess seals a tamper-evident verdict; verifyAssessment confirms it', () => {
  const a = assess(SAMPLES[2], { at: '2026-09-15T00:00:00Z' });
  assert.equal(a.kind, 'euaiact-assessment');
  assert.equal(a.tier, 'high');
  assert.equal(verifyAssessment(a).valid, true);
});

test('assess: a changed tier breaks the seal', () => {
  const a = assess(SAMPLES[2], { at: '2026-09-15T00:00:00Z' });
  const tampered = { ...a, tier: 'minimal' };   // pretend the high-risk verdict was downgraded
  assert.equal(verifyAssessment(tampered).valid, false);
  assert.equal(verifyAssessment({ hash: 'x' }).ok, false);
  assert.equal(verifyAssessment({ kind: 'euaiact-assessment' }).ok, false);
});

test('assess: the textHash binds the verdict to the exact description', () => {
  const a = assess(SAMPLES[2], {});
  const b = assess(SAMPLES[2] + ' ', {});
  assert.notEqual(a.textHash, b.textHash);   // one trailing space changes the bound text
});

test('fuzz: pure and total — garbage never throws', () => {
  const junk = [null, undefined, 0, '', [], {}, NaN, true, Symbol.for('x'), { kind: 5 }];
  for (const a of junk) {
    assert.doesNotThrow(() => { classifyText(a); obligationsFor(a); deadlineFor(a); assess(a, a); verifyAssessment(a); });
  }
});
