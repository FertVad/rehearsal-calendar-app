// Fails unless the last link the app handed to iOS on the simulator
// ${SIMULATOR}, in the last two minutes, is exactly ${URL} — as SpringBoard
// logged it (server-with-mailbox.mjs, /opened-urls). For a link whose page
// goes on to an app the simulator does not have: the App Store's review page
// (flow 107, T-410).
// Run by Maestro (runScript), which provides http and json.
const response = http.get(MAIL_URL + '/opened-urls?device=' + encodeURIComponent(SIMULATOR));
if (!response.ok) throw new Error('opened-urls answered ' + response.status + ': ' + response.body);
const urls = json(response.body).urls;
const last = urls[urls.length - 1];
if (last !== URL) throw new Error('the app opened ' + (last || 'no link') + ', not ' + URL);
