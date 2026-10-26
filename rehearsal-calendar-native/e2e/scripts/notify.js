// ${COUNT} new notifications for ${EMAIL}, titled "${TITLE} 1" (the oldest) to
// "${TITLE} ${COUNT}", recorded as the server records them while the app is
// open — what a busy week of changes would leave (server-with-mailbox.mjs).
// Run by Maestro (runScript), which provides http.
const response = http.get(MAIL_URL + '/notify?to=' + encodeURIComponent(EMAIL) + '&count=' + COUNT + '&title=' + encodeURIComponent(TITLE));
if (!response.ok) throw new Error('notify answered ' + response.status + ': ' + response.body);
