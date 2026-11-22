(() => {
  'use strict';
  const status = document.getElementById('status');
  const manual = document.getElementById('manual');
  const open = document.getElementById('openButton');
  const nativeOpen = document.getElementById('nativeOpenButton');

  // Language, chosen as the landing page chooses it (public/i18n.js): ?lang=
  // first, then the remembered choice shared with the landing and legal pages,
  // then the browser. Every language is already in the markup with English
  // shown, so a page whose script never runs still reads.
  const STORE_KEY = 'rehearsly-lang';
  const LANGS = ['en', 'ru', 'es', 'de'];
  const blocks = document.querySelectorAll('[data-l]');
  const buttons = document.querySelectorAll('[data-lang]');
  const heading = document.querySelector('h1');

  function setLang(lang, remember) {
    blocks.forEach(el => { el.hidden = el.getAttribute('data-l') !== lang; });
    buttons.forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === lang)));
    document.documentElement.lang = lang;
    document.title = `${heading.innerText.trim()} · Rehearsly`;
    if (remember) {
      try { localStorage.setItem(STORE_KEY, lang); } catch { /* private mode */ }
    }
  }

  function initialLang() {
    const q = /[?&]lang=([a-z]{2})(?:&|$)/i.exec(location.search);
    if (q && LANGS.includes(q[1].toLowerCase())) return q[1].toLowerCase();
    let saved = null;
    try { saved = localStorage.getItem(STORE_KEY); } catch { /* private mode */ }
    if (LANGS.includes(saved)) return saved;
    const prefix = (navigator.language || 'en').toLowerCase().slice(0, 2);
    return LANGS.includes(prefix) ? prefix : 'en';
  }

  buttons.forEach(b => b.addEventListener('click', () => setLang(b.getAttribute('data-lang'), true)));
  document.getElementById('langSwitch').hidden = false;
  setLang(initialLang(), false);

  const timers = [];
  function showManual() {
    timers.forEach(clearTimeout);
    timers.length = 0;
    status.hidden = true;
    manual.hidden = false;
  }
  // Returning from another app must not resume a pending second auto launch.
  document.addEventListener('visibilitychange', showManual);
  window.addEventListener('pageshow', event => { if (event.persisted) showManual(); });
  if (document.visibilityState === 'hidden') return;

  const schemes = [open.href, ...(nativeOpen ? [nativeOpen.href] : [])];
  manual.hidden = true;
  status.hidden = false;
  // Arm recovery before attempting navigation, including when it throws or is
  // refused. Manual links keep the browser's default trusted-click behavior;
  // they do not depend on a handler, timer, or JavaScript being available.
  timers.push(setTimeout(showManual, 2000 + (schemes.length - 1) * 500));
  schemes.forEach((scheme, index) => {
    timers.push(setTimeout(() => {
      try { window.location.assign(scheme); } catch { /* Manual link remains available. */ }
    }, index * 500));
  });
})();
