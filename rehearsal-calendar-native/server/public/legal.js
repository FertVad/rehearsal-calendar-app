/*
 * Language toggle for the legal / support pages.
 *
 * Both languages ship in the markup and one is hidden, rather than being
 * swapped in by script: a policy has to stay readable if JavaScript fails, and
 * search engines should see both. The choice is remembered, and shared with the
 * marketing page through the same storage key.
 */
(function () {
  var KEY = 'rehearsly-lang';
  // Kept in step with the app's own locales, so someone reading the policy
  // sees it in the language they use Rehearsly in.
  var SUPPORTED = ['en', 'ru', 'es', 'de'];

  function pick() {
    try {
      var saved = localStorage.getItem(KEY);
      if (SUPPORTED.indexOf(saved) !== -1) return saved;
    } catch (e) {
      // Private mode or storage disabled — fall through to the browser locale.
    }
    var prefix = (navigator.language || 'en').toLowerCase().slice(0, 2);
    return SUPPORTED.indexOf(prefix) !== -1 ? prefix : 'en';
  }

  function apply(lang) {
    document.documentElement.lang = lang;

    document.querySelectorAll('[data-content]').forEach(function (section) {
      section.hidden = section.getAttribute('data-content') !== lang;
    });

    document.querySelectorAll('[data-lang]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.getAttribute('data-lang') === lang));
    });

    try {
      localStorage.setItem(KEY, lang);
    } catch (e) {
      // Not being able to remember the choice is not worth failing over.
    }
  }

  document.querySelectorAll('[data-lang]').forEach(function (button) {
    button.addEventListener('click', function () {
      apply(button.getAttribute('data-lang'));
    });
  });

  apply(pick());
})();
