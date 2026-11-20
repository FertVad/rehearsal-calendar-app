/* ============================================================
   Rehearsly cinematic landing — what differs between the audience pages.

   Two things, both about telling the pages apart without any analytics:
   - a request for access names the page it came from in its subject, in the
     reader's language, and says so when a performer sent the reader here;
   - "send it to your director" hands the director's page on, in the
     language on screen, marked as coming from a performer.
   No dependencies; the pages read fine if this never runs (the links then
   carry the plain "TestFlight" subject and open the director's page).
   ============================================================ */
(function () {
  'use strict';

  var SUBJECT = {
    cast: { en: 'TestFlight — performer', ru: 'TestFlight — артист', es: 'TestFlight — artista', de: 'TestFlight — Mitwirkende' },
    lead: { en: 'TestFlight — director', ru: 'TestFlight — режиссёр', es: 'TestFlight — dirección', de: 'TestFlight — Regie' },
  };
  var VIA_CAST = { en: ' (sent by a performer)', ru: ' (от артиста)', es: ' (de alguien del grupo)', de: ' (von Mitwirkenden)' };
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
  var fromCast = /[?&]ref=cast(&|$)/.test(location.search);

  function subjects() {
    var l = lang();
    [].forEach.call(document.querySelectorAll('[data-mail]'), function (a) {
      var page = a.getAttribute('data-mail');
      var s = (SUBJECT[page] || {})[l] || 'TestFlight';
      // A director a performer sent here; on the performers' own page the
      // mark would only repeat itself.
      if (fromCast && page !== 'cast') s += VIA_CAST[l];
      a.href = 'mailto:support@rehearsly.me?subject=' + encodeURIComponent(s);
    });
  }
  document.addEventListener('langchange', subjects);
  subjects();

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
