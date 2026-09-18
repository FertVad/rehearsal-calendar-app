(() => {
  'use strict';
  const status = document.getElementById('status');
  const manual = document.getElementById('manual');
  const open = document.getElementById('openButton');
  const nativeOpen = document.getElementById('nativeOpenButton');
  const isRu = navigator.language.toLowerCase().startsWith('ru');
  document.documentElement.lang = isRu ? 'ru' : 'en';
  if (isRu) {
    document.getElementById('statusText').textContent = 'Открываем приложение...';
    document.getElementById('manualText').textContent = 'Приложение не открылось автоматически?';
    open.textContent = 'Открыть приложение';
    if (nativeOpen) nativeOpen.textContent = 'Открыть установленное приложение';
    document.getElementById('installText').textContent = 'Если приложение не установлено, установите Rehearsly и вернитесь к этому приглашению.';
  }

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
