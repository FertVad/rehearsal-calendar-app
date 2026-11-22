/* ============================================================
   Rehearsly cinematic landing — what differs between the audience pages.

   "Send it to your director" hands the director's page on, in the language
   on screen, with ref=cast in the address to mark the visit as one a
   performer sent. Only the performers' page loads this.
   No dependencies; the page reads fine if this never runs (the link then
   simply opens the director's page).
   ============================================================ */
(function () {
  'use strict';

  var SHARE = {
    en: { text: 'Rehearsly: the cast marks when they’re busy, and rehearsals land on everyone’s calendar. Worth a try?', done: 'Link copied' },
    ru: { text: 'Rehearsly: состав отмечает время сам, а репетиции приходят всем в календарь. Попробуем?', done: 'Ссылка скопирована' },
    es: { text: 'Rehearsly: cada uno marca cuándo no puede y los ensayos llegan solos al calendario de todos. ¿Lo probamos?', done: 'Enlace copiado' },
    de: { text: 'Rehearsly: Alle tragen selbst ein, wann sie keine Zeit haben, und die Proben landen bei allen im Kalender. Probieren wir’s?', done: 'Link kopiert' },
  };

  function lang() {
    var l = document.documentElement.lang;
    return SHARE[l] ? l : 'en';
  }

  function flash(a, text) {
    a.setAttribute('data-done', text);
    a.classList.add('is-done');
    clearTimeout(a._done);
    a._done = setTimeout(function () { a.classList.remove('is-done'); }, 2200);
  }

  [].forEach.call(document.querySelectorAll('[data-share]'), function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var l = lang();
      var url = new URL(a.getAttribute('href'), location.href);
      url.searchParams.set('ref', 'cast');
      url.searchParams.set('lang', l);
      var text = SHARE[l].text;

      function copy() {
        var all = text + ' ' + url.href;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(all).then(function () { flash(a, SHARE[l].done); }, mail);
        } else {
          mail();
        }
      }
      // Nothing to copy into and nothing to share with: a letter to write.
      function mail() {
        location.href = 'mailto:?subject=Rehearsly&body=' + encodeURIComponent(text + '\n\n' + url.href);
      }

      if (navigator.share) {
        navigator.share({ title: 'Rehearsly', text: text, url: url.href }).catch(function (err) {
          if (!err || err.name !== 'AbortError') copy();
        });
      } else {
        copy();
      }
    });
  });
})();
