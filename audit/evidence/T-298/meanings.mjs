// T-298: each of the three native-speaker fixes checked on its own, the same
// predicates as the new test in privacyPage.test.js (which stops at the first).
// Usage: node meanings.mjs <privacy.html>
import fs from 'fs';

const NATIVE = {
  en: { often: 'To see how often Rehearsly is used', atMost: 'Kept for no longer than 13 months', months: /13 months/,
    lede: /records for its internal statistics/, ledeWas: /own statistics/ },
  ru: { often: 'Видеть, как часто пользуются Rehearsly', atMost: 'Хранятся не дольше 13 месяцев', months: /13 месяцев/,
    lede: /записей для внутренней статистики/, ledeWas: /собственной статистики/ },
  es: { often: 'Ver con qué frecuencia se usa Rehearsly', atMost: 'Se conservan como máximo 13 meses', months: /13 meses/,
    lede: /registros para sus estadísticas internas/, ledeWas: /propias estadísticas/ },
  de: { often: 'Sehen, wie oft Rehearsly genutzt wird', atMost: 'Höchstens 13 Monate gespeichert', months: /13 Monate/,
    lede: /Einträge für die interne Statistik/, ledeWas: /eigene Statistik/ },
};

const page = fs.readFileSync(process.argv[2], 'utf8');
let bad = 0;
for (const [lang, n] of Object.entries(NATIVE)) {
  const html = new RegExp(`<section data-content="${lang}"[^>]*>([\\s\\S]*?)</section>`).exec(page)[1].replace(/\s+/g, ' ');
  const cells = [...html.matchAll(/<td>([^<]*)<\/td>/g)].map(m => m[1]);
  const terms = cells.filter(c => n.months.test(c));
  const lede = /<p class="lede">([\s\S]*?)<\/p>/.exec(html)[1];
  const checks = {
    '1 how often': cells.filter(c => c.startsWith(n.often)).length === 1,
    '2 at most 13 months, both rows': terms.length === 2 && terms.every(c => c.includes(n.atMost)),
    '3 internal statistics in the lede': n.lede.test(lede) && !n.ledeWas.test(lede),
  };
  for (const [name, ok] of Object.entries(checks)) {
    if (!ok) bad++;
    console.log(`${lang}  ${name}: ${ok ? 'yes' : 'NO'}`);
  }
}
console.log(bad ? `${bad} of 12 missing` : 'all 12 present');
