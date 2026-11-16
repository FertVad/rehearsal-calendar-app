// Raises the local server's minimum app build above the app's own, or lowers
// it again, as the owner does with MIN_IOS_BUILD in Vercel (T-265, flow 97).
// The server's own middleware then refuses the app with 426 UPDATE_REQUIRED.
// Run by Maestro (runScript), which provides http and json.
// ${MAIL_URL} is the mailbox's address; ${ON} is "1" to raise it, "0" to lower
// it. A raised minimum lapses after three minutes on its own.
const response = http.get(MAIL_URL + '/min-build?above=' + (ON === '1' ? '1' : '0'));
if (!response.ok) throw new Error('min-build answered ' + response.status + ': ' + response.body);
