/**
 * The privacy policy names every provider that processes personal data (T-038).
 * Since 04.11 production sends sign-up, password-reset and address-change codes
 * through Resend (eu-west-1, Ireland): it receives the address and the message
 * with the code. The page listed Neon, Vercel, Expo and Google/Apple only.
 *
 * Every language is checked on its own, since each is written separately.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const html = readFileSync(fileURLToPath(new URL('../../public/privacy.html', import.meta.url)), 'utf8');

const IRELAND = { en: 'Ireland', ru: 'Ирландия', es: 'Irlanda', de: 'Irland' };
// The American order in English, «г.» after the year in Russian (the editors, T-269).
// The last revision: the internal statistics (T-293).
const REVISED = {
  en: 'November 23, 2026',
  ru: '23 ноября 2026 г.',
  es: '23 de noviembre de 2026',
  de: '23. November 2026',
};

function section(lang) {
  const match = html.match(new RegExp(`<section data-content="${lang}"[^>]*>([\\s\\S]*?)</section>`));
  if (!match) throw new Error(`No ${lang} section`);
  return match[1];
}

/** The list right after the processors heading — the second <h2> after "Payments". */
function processors(lang) {
  const body = section(lang);
  const headings = [...body.matchAll(/<h2>/g)].map((m) => m.index);
  // Order of h2s: responsible, collect, payments, processors, retention, …
  const start = headings[3];
  const end = headings[4];
  return body.slice(start, end);
}

function collected(lang) {
  const body = section(lang);
  return body.slice(body.indexOf('<table>'), body.indexOf('</table>'));
}

describe.each(Object.keys(IRELAND))('privacy policy, %s', (lang) => {
  test('lists Resend among the processors, with its EU region', () => {
    const list = processors(lang);
    const item = list.split('<li>').find((li) => li.includes('Resend'));
    expect(item).toBeDefined();
    expect(item).toContain(IRELAND[lang]);
  });

  test('says what is kept of an email code and for how long it works', () => {
    // codes.js: CODE_TTL_MS = 15 minutes, only an HMAC of the code is stored
    expect(collected(lang)).toMatch(/15/);
  });

  test('the update date is that of the last revision (T-269), as each language writes a date', () => {
    const updated = section(lang).match(/<p class="updated">([^<]*)<\/p>/)[1];
    expect(updated).toContain(REVISED[lang]);
  });
});
