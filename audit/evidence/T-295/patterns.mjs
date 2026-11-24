// T-295 evidence: every pattern privacyPage.test.js holds for the policy, one by
// one, against privacy.html at the T-293 end (315301f) and at HEAD. The pattern
// objects are taken from the test file itself, so this checks what the test checks.
// Run from the repository root: node audit/evidence/T-295/patterns.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const ROOT = new URL('../../../', import.meta.url);
const TEST = 'rehearsal-calendar-native/server/__tests__/routes/privacyPage.test.js';
const PAGE = 'rehearsal-calendar-native/server/public/privacy.html';
const source = fs.readFileSync(new URL(TEST, ROOT), 'utf8');
const block = (name) => {
  const match = new RegExp(`^const ${name} = (\\{[\\s\\S]*?\\n\\});`, 'm').exec(source);
  if (!match) throw new Error(`no ${name} in the test`);
  return new Function(`return ${match[1]};`)();
};
const STATISTICS = block('STATISTICS');
const ROWS = block('ROWS');
const NO_SDK = block('NO_SDK');
const SIGN_IN = block('SIGN_IN');

const pageAt = (rev) => execFileSync('git', ['show', `${rev}:${PAGE}`], { encoding: 'utf8', cwd: ROOT });
const section = (html, lang) => new RegExp(`<section data-content="${lang}"[^>]*>([\\s\\S]*?)</section>`).exec(html)[1];
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

function checks(html, lang) {
  const raw = section(html, lang);
  const page = text(raw);
  const flat = raw.replace(/\s+/g, ' ');
  const out = [];
  const stats = STATISTICS[lang];
  for (const key of ['purpose', 'shows', 'noThirdParty', 'onlyOperator', 'signInWhy']) out.push([`STATISTICS.${key}`, stats[key].test(page)]);
  stats.reads.forEach((re, i) => out.push([`STATISTICS.reads[${i}]`, re.test(page)]));
  const rows = ROWS[lang];
  for (const name of ['exported', 'introduction']) {
    const row = `<tr> ${rows[name].map((cell) => `<td>${cell}</td>`).join(' ')} </tr>`;
    const at = flat.indexOf(row);
    const before = at < 0 ? -1 : flat.lastIndexOf(`<td>${rows[`${name}After`]}`, at);
    const one = before >= 0 && (flat.slice(before, at + 4).match(/<tr>/g) || []).length === 1;
    out.push([`ROWS.${name} (row, right after its neighbour)`, at > 0 && one]);
  }
  out.push(['ROWS.goesWithAccount', rows.goesWithAccount.test(page)]);
  out.push(['NO_SDK.lede', NO_SDK[lang].lede.test(page)]);
  out.push(['NO_SDK.notCollected', NO_SDK[lang].notCollected.test(page)]);
  out.push(['SIGN_IN.says (statistics)', SIGN_IN[lang].says.at(-1).test(page)]);
  return out;
}

const old = pageAt('315301f');
const head = pageAt('HEAD');
let bad = 0;
for (const lang of ['en', 'ru', 'es', 'de']) {
  const before = checks(old, lang);
  const after = checks(head, lang);
  for (let i = 0; i < before.length; i += 1) {
    const [name, was] = before[i];
    const now = after[i][1];
    // Unchanged texts stay green before and after; everything else red then green.
    const verdict = !now ? 'FAIL (red at HEAD)' : was ? 'green before and after (text unchanged)' : 'red before, green after';
    if (!now) bad += 1;
    console.log(`${lang} ${name}: ${verdict}`);
  }
}
process.exitCode = bad ? 1 : 0;
