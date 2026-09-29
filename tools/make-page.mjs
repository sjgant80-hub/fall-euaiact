#!/usr/bin/env node
// make-page.mjs — the fixpoint. index.html runs the SAME kernel.mjs (the risk classifier) and comply.mjs (the
// compliance map, with law/law.json) that the tests and the mutation gate prove. CI regenerates the page and
// fails if it differs. comply.mjs runs in its own scope so its helper names cannot clash with the classifier's.
import { readFileSync, writeFileSync } from 'node:fs';
const read = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const kernel = read('kernel.mjs')
  .replace(/^export default .*;?\s*$/gm, '')   // drop the default re-export (would be invalid inline)
  .replace(/^export /gm, '').trimEnd();
const NAMES = ['DEPLOYMENTS', 'STATUSES', 'CONDITIONS', 'AI_KINDS', 'BUILT_BY', 'ANNEX_III', 'TIERS', 'obligations', 'declare', 'tierOf', 'complianceMap'];
const comply = 'const COMPLY = (() => {\n' + read('comply.mjs').replace(/^export /gm, '').trimEnd() + '\nreturn { ' + NAMES.join(', ') + ' };\n})();\n'
  + 'const COMPLY_LAW = ' + JSON.stringify(JSON.parse(read('law/law.json'))).replace(/</g, '\\u003c') + ';';
let page = read('index.html');
const swap = (begin, end, body) => {
  const a = page.indexOf(begin), b = page.indexOf(end);
  if (a === -1 || b === -1 || b < a) { console.error('markers missing: ' + begin); process.exit(1); }
  page = page.slice(0, a + begin.length) + '\n' + body + '\n' + page.slice(b);
};
swap('// ⟦KERNEL-BEGIN⟧ generated from kernel.mjs by make-page.mjs — do not edit here', '// ⟦KERNEL-END⟧', kernel);
swap('// ⟦COMPLY-BEGIN⟧ generated from comply.mjs and law/law.json by make-page.mjs — do not edit here', '// ⟦COMPLY-END⟧', comply);
writeFileSync(new URL('../index.html', import.meta.url), page);
console.log('kernel injected: ' + kernel.length + ' chars · comply + law injected: ' + comply.length + ' chars');
