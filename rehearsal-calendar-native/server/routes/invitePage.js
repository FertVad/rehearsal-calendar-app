import { escapeHtml } from '../utils/htmlEscape.js';

function expoAuthority(value) {
  // This optional development target is an authority, never a URL/path or a
  // repeated/structured query parameter. Invalid input keeps the native link.
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

// Render usable links before JavaScript loads. Neither the document nor its
// assets need a database, a valid session, or a successful invite lookup.
export function generateInvitePageHTML(code, expoHost) {
  const segment = encodeURIComponent(String(code || ''));
  const nativeUrl = `rehearsalapp://invite/${segment}`;
  const authority = expoAuthority(expoHost);
  const primaryUrl = authority ? `exp://${authority}/--/invite/${segment}` : nativeUrl;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Join Project - Rehearsal App</title>
  <link rel="stylesheet" href="/invite-page/invite.css">
  <script src="/invite-page/invite.js" defer></script>
</head>
<body>
  <main class="container">
    <h1>🎭 Rehearsal App</h1>
    <div id="status" role="status" hidden>
      <div class="spinner" aria-hidden="true"></div>
      <p id="statusText">Opening the app...</p>
    </div>
    <div id="manual">
      <p id="manualText">App didn't open automatically?</p>
      <a href="${escapeHtml(primaryUrl)}" class="button" id="openButton">Open App</a>
      ${authority ? `<a href="${escapeHtml(nativeUrl)}" class="button" id="nativeOpenButton">Open installed app</a>` : ''}
      <p id="installText">If the app is not installed, install Rehearsly and return to this invitation.</p>
    </div>
  </main>
</body>
</html>`;
}
