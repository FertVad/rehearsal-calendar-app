/* ============================================================
   Rehearsly landing — the language, settled before anything is drawn.

   Loaded in <head>, ahead of the body, so `html[data-lang]` is there for the
   first layout. The phones hold every language's screenshots and show the
   one this names (cinema.js reads it): decided any later, the browser has already
   asked for the English hero by the time i18n.js hides it. A script of its
   own because the server's policy refuses inline ones.
   ============================================================ */
(function () {
  'use strict';

  var STORE_KEY = 'rehearsly-lang';   // shared with i18n.js and legal.js
  var LANGS = ['en', 'ru', 'es', 'de'];   // same four the app itself speaks

  function pick() {
    // ?lang=de wins over everything, so a link can be shared in one language
    // regardless of what the reader's browser or last visit says.
    var q = /[?&]lang=([a-z]{2})/i.exec(location.search);
    if (q && LANGS.indexOf(q[1].toLowerCase()) >= 0) return q[1].toLowerCase();

    var saved = null;
    try { saved = localStorage.getItem(STORE_KEY); } catch (e) { /* private mode */ }
    // legal.js writes the same key but knows four locales; anything this page
    // cannot show falls back to English rather than to the browser's guess.
    if (saved) return LANGS.indexOf(saved) >= 0 ? saved : 'en';
    var prefix = (navigator.language || 'en').toLowerCase().slice(0, 2);
    return LANGS.indexOf(prefix) >= 0 ? prefix : 'en';
  }

  var lang = pick();
  document.documentElement.setAttribute('data-lang', lang);
  document.documentElement.lang = lang;
})();
