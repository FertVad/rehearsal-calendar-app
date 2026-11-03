/**
 * The support and privacy pages open in the language a link asks for (T-011).
 * The app's Help opens /support?lang=<the app's language>; legal.js read only
 * the last choice and the browser's locale, so a Russian app opened a page in
 * whatever language Safari had. The landing page (i18n.js) already let ?lang win.
 *
 * legal.js is run as the browser runs it, in a sandbox with the four sections
 * of the page and the four buttons.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const source = readFileSync(fileURLToPath(new URL('../../public/legal.js', import.meta.url)), 'utf8');
const LANGS = ['en', 'ru', 'es', 'de'];

function openPage({ search = '', saved = null, browser = 'en-US' } = {}) {
  const sections = LANGS.map((lang) => ({ hidden: lang !== 'en', getAttribute: () => lang }));
  const buttons = LANGS.map((lang) => ({
    getAttribute: () => lang,
    setAttribute() {},
    addEventListener() {},
  }));
  const store = new Map(saved ? [['rehearsly-lang', saved]] : []);
  const document = {
    documentElement: {},
    querySelectorAll: (selector) => (selector === '[data-content]' ? sections : buttons),
  };
  vm.runInNewContext(source, {
    document,
    location: { search },
    navigator: { language: browser },
    localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
  });
  return {
    shown: LANGS.filter((_, i) => !sections[i].hidden),
    lang: document.documentElement.lang,
    saved: store.get('rehearsly-lang'),
  };
}

describe('legal.js language', () => {
  it('shows the language the link asks for, over the last choice and the browser', () => {
    expect(openPage({ search: '?lang=ru', saved: 'de', browser: 'en-US' })).toEqual({ shown: ['ru'], lang: 'ru', saved: 'ru' });
    expect(openPage({ search: '?x=1&lang=ES' }).shown).toEqual(['es']);
  });

  it('ignores a language it does not have', () => {
    expect(openPage({ search: '?lang=fr', saved: 'de' }).shown).toEqual(['de']);
  });

  it('without one, keeps the last choice, then the browser', () => {
    expect(openPage({ saved: 'de' }).shown).toEqual(['de']);
    expect(openPage({ browser: 'ru-RU' }).shown).toEqual(['ru']);
  });
});
