/* ============================================================
   Rehearsly landing — language toggle, reveals, phone scroll.
   No build step, no dependencies.
   ============================================================ */
(function () {
  'use strict';

  /* ── Language ─────────────────────────────────────────────
     Both languages are written out in index.html and one is hidden, so there
     is no dictionary here and nothing to keep in step with the markup. Each
     language is authored on its own terms rather than translated phrase by
     phrase, and any of them reads fine if this script never runs. */

  var STORE_KEY = 'rehearsly-lang';   // shared with legal.js
  var LANGS = ['en', 'ru', 'es', 'de'];   // same four the app itself speaks

  var blocks = [].slice.call(document.querySelectorAll('[data-l]'));
  var buttons = [].slice.call(document.querySelectorAll('[data-lang]'));

  function setLang(lang) {
    blocks.forEach(function (el) {
      el.hidden = el.getAttribute('data-l') !== lang;
    });
    buttons.forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === lang));
    });
    document.documentElement.lang = lang;
    try { localStorage.setItem(STORE_KEY, lang); } catch (e) { /* private mode */ }
  }

  function initialLang() {
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

  buttons.forEach(function (b) {
    b.addEventListener('click', function () { setLang(b.getAttribute('data-lang')); });
  });
  setLang(initialLang());

  /* ── Reveal on scroll ─────────────────────────────────────
     The `js` class is what hides these in the first place, so a page whose
     script never runs shows everything rather than a column of blanks. */
  document.documentElement.classList.add('js');

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reveals = [].slice.call(document.querySelectorAll('[data-reveal]'));

  if (reduced.matches || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);       // reveal once, never flicker back
      });
    }, { rootMargin: '0px 0px -12% 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* ── Screen content scrolls inside the phone ──────────────

     Each frame is pinned to the middle of the viewport for as long as its
     screenshot has left to travel, and the strip inside moves by exactly that
     distance meanwhile. So the content starts at the top of the screen when
     the phone arrives, and finishes before it leaves — which tying the motion
     to the phone's transit across the viewport cannot do: a frame is only
     fully in view for a couple of hundred pixels of scrolling, far less than
     the strips need.

     The pinning itself is `position: sticky`; script only measures how tall
     the rail has to be and how far the strip should move. */
  if (reduced.matches) return;

  var MIN_TRAVEL = 8;   // below this the pin is imperceptible; skip the rail

  var phones = [].slice.call(document.querySelectorAll('[data-phone]')).map(function (el) {
    return { el: el, img: el.querySelector('[data-scroll]'), travel: 0, rail: null, visible: true };
  }).filter(function (p) {
    // The offset phone behind the projects section is absolutely positioned;
    // wrapping it in a rail would tear it out of its layout for no gain.
    return p.img && !p.el.classList.contains('phone--back');
  });

  if (!phones.length) return;

  var vis = null;
  var ticking = false;

  function measure(p) {
    var win = p.img.parentElement;
    p.travel = Math.max(0, p.img.offsetHeight - win.clientHeight);
  }

  function buildRail(p) {
    if (p.rail) return;
    var rail = document.createElement('div');
    rail.className = 'phone-rail';
    var stick = document.createElement('div');
    stick.className = 'phone-stick';
    p.el.parentNode.insertBefore(rail, p.el);
    rail.appendChild(stick);
    stick.appendChild(p.el);
    p.rail = rail;
    p.stick = stick;
    if (vis) vis.observe(rail);
  }

  function layout() {
    var vh = window.innerHeight;
    for (var i = 0; i < phones.length; i++) {
      var p = phones[i];
      measure(p);
      if (p.travel < MIN_TRAVEL) {
        if (p.rail) { p.rail.style.height = ''; p.stick.style.top = ''; }
        p.img.style.transform = '';
        continue;
      }
      buildRail(p);
      var frame = p.el.offsetHeight;
      // Centre the frame when it fits, otherwise sit it just below the header.
      p.top = Math.max(16, Math.round((vh - frame) / 2));
      p.rail.style.height = (frame + p.travel) + 'px';
      p.stick.style.top = p.top + 'px';
    }
    update();
  }

  function update() {
    ticking = false;
    for (var i = 0; i < phones.length; i++) {
      var p = phones[i];
      if (!p.rail || p.travel < MIN_TRAVEL || !p.visible) continue;
      var moved = p.top - p.rail.getBoundingClientRect().top;
      if (moved < 0) moved = 0;
      else if (moved > p.travel) moved = p.travel;
      p.img.style.transform = 'translate3d(0,' + -moved.toFixed(1) + 'px,0)';
    }
  }

  function request() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  if ('IntersectionObserver' in window) {
    vis = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        for (var i = 0; i < phones.length; i++) {
          if (phones[i].rail === entry.target) phones[i].visible = entry.isIntersecting;
        }
      });
      request();
    }, { rootMargin: '25% 0px' });
  }

  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', layout);
  window.addEventListener('load', layout);
  layout();
})();
