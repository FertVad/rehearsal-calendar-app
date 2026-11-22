import { escapeHtml } from '../utils/htmlEscape.js';

// The app's App Store listing. Campaign tokens (pt/ct) are left off until there
// is a provider token to put in them (T-267).
const APP_STORE_ID = '6830809401';
const APP_STORE_URL = `https://apps.apple.com/app/id${APP_STORE_ID}`;
const LANGS = ['en', 'ru', 'es', 'de'];

function validAuthority(value) {
  // A host[:port], never a URL/path or a repeated/structured query parameter.
  if (typeof value !== 'string' || value.length > 300 ||
      !/^(?:\[[0-9a-f:.]+\]|[a-z0-9.-]+)(?::\d{1,5})?$/i.test(value)) return null;
  try {
    const url = new URL(`http://${value}`);
    return url.hostname && !url.username && !url.password &&
      url.pathname === '/' && !url.search && !url.hash ? value : null;
  } catch {
    return null;
  }
}

// Every language is written out in the markup and all but English are hidden,
// as on the landing page: the page reads without JavaScript, and invite.js only
// chooses which one shows. Each language is written on its own terms.
const TEXT = {
  heading: {
    en: 'You’ve been invited to a project',
    ru: 'Вас пригласили в проект',
    es: 'Tienes una invitación a un proyecto',
    de: 'Du wurdest zu einem Projekt eingeladen',
  },
  lead: {
    en: 'Rehearsly is the rehearsal schedule that shows when everyone in the project is free. Invitations open in the app.',
    ru: 'Rehearsly — расписание репетиций, в котором видно, когда свободны все участники проекта. Приглашение открывается в приложении.',
    es: 'Rehearsly es el calendario de ensayos que muestra cuándo están libres todos los participantes. La invitación se abre en la app.',
    de: 'Rehearsly ist der Probenplan, der zeigt, wann alle im Projekt Zeit haben. Die Einladung öffnet sich in der App.',
  },
  opening: {
    en: 'Opening Rehearsly…',
    ru: 'Открываем Rehearsly…',
    es: 'Abriendo Rehearsly…',
    de: 'Rehearsly wird geöffnet …',
  },
  install: {
    en: 'Install Rehearsly from the App Store.',
    ru: 'Установите Rehearsly из App Store.',
    es: 'Instala Rehearsly desde el App Store.',
    de: 'Installiere Rehearsly aus dem App Store.',
  },
  appStore: {
    en: 'Open in the App Store',
    ru: 'Открыть в App Store',
    es: 'Abrir en el App Store',
    de: 'Im App Store öffnen',
  },
  comeBack: {
    en: 'Come back to this page and tap “Open invitation”.',
    ru: 'Вернитесь на эту страницу и нажмите «Открыть приглашение».',
    es: 'Vuelve a esta página y toca «Abrir invitación».',
    de: 'Komm auf diese Seite zurück und tippe auf „Einladung öffnen“.',
  },
  open: {
    en: 'Open invitation',
    ru: 'Открыть приглашение',
    es: 'Abrir invitación',
    de: 'Einladung öffnen',
  },
  openInstalled: {
    en: 'Open installed app',
    ru: 'Открыть установленное приложение',
    es: 'Abrir la app instalada',
    de: 'Installierte App öffnen',
  },
  note: {
    en: 'Already have the app? Go straight to step 2. Installing it won’t open the invitation by itself, so do come back here.',
    ru: 'Rehearsly уже установлен? Сразу переходите ко второму шагу. После установки приглашение само не откроется — поэтому и нужно вернуться сюда.',
    es: '¿Ya tienes la app? Pasa directamente al paso 2. Instalarla no abre la invitación: por eso hay que volver aquí.',
    de: 'App schon installiert? Dann direkt weiter mit Schritt 2. Nach der Installation öffnet sich die Einladung nicht von allein – komm deshalb hierher zurück.',
  },
};

function say(key, tag = 'span') {
  return LANGS.map(lang =>
    `<${tag} data-l="${lang}" lang="${lang}"${lang === 'en' ? '' : ' hidden'}>${escapeHtml(TEXT[key][lang])}</${tag}>`,
  ).join('');
}

// Render usable links before JavaScript loads. Neither the document nor its
// assets need a database, a valid session, or a successful invite lookup.
// `origin` is the address this page was requested at ({ protocol, host }); the
// Smart App Banner hands the app this invitation's own address.
export function generateInvitePageHTML(code, expoHost, origin = {}) {
  const segment = encodeURIComponent(String(code || ''));
  const nativeUrl = `rehearsalapp://invite/${segment}`;
  const authority = validAuthority(expoHost);
  const primaryUrl = authority ? `exp://${authority}/--/invite/${segment}` : nativeUrl;
  const host = validAuthority(origin.host);
  const protocol = origin.protocol === 'http' ? 'http' : 'https';
  const banner = `app-id=${APP_STORE_ID}${host ? `, app-argument=${protocol}://${host}/invite/${segment}` : ''}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation · Rehearsly</title>
  <meta name="robots" content="noindex">
  <meta name="theme-color" content="#0d1117">
  <meta name="apple-itunes-app" content="${escapeHtml(banner)}">
  <link rel="icon" href="/assets/icon-64.png" sizes="64x64">
  <link rel="apple-touch-icon" href="/assets/icon-180.png">
  <link rel="stylesheet" href="/invite-page/invite.css">
  <script src="/invite-page/invite.js" defer></script>
</head>
<body>
  <main class="card">
    <header class="top">
      <span class="brand"><img class="brand__mark" src="/assets/icon-180.png" width="40" height="40" alt=""><span class="brand__name">Rehearsly</span></span>
      <div class="lang" id="langSwitch" role="group" aria-label="Language · Язык · Idioma · Sprache" hidden>
        ${LANGS.map(lang => `<button type="button" data-lang="${lang}" lang="${lang}">${lang.toUpperCase()}</button>`).join('')}
      </div>
    </header>
    <h1>${say('heading')}</h1>
    <p class="lead">${say('lead')}</p>
    <div id="status" role="status" hidden>
      <div class="spinner" aria-hidden="true"></div>
      <p id="statusText">${say('opening')}</p>
    </div>
    <div id="manual">
      <ol class="steps">
        <li>
          <p id="installText">${say('install')}</p>
          <a href="${APP_STORE_URL}" class="btn btn--ghost" id="appStoreButton">${say('appStore')}</a>
        </li>
        <li>
          <p id="manualText">${say('comeBack')}</p>
          <a href="${escapeHtml(primaryUrl)}" class="btn btn--primary" id="openButton">${say('open')}</a>
          ${authority ? `<a href="${escapeHtml(nativeUrl)}" class="btn btn--ghost" id="nativeOpenButton">${say('openInstalled')}</a>` : ''}
        </li>
      </ol>
      <p class="note">${say('note')}</p>
    </div>
  </main>
</body>
</html>`;
}
