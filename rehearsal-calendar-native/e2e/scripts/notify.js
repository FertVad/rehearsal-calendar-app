// ${COUNT} new notifications for ${EMAIL}, titled "${TITLE} 1" (the oldest) to
// "${TITLE} ${COUNT}", recorded as the server records them while the app is
// open — what a busy week of changes would leave (server-with-mailbox.mjs).
// With TYPE "member_joined": one "New member" about the project named
// ${PROJECT}, ${MEMBER} having joined it, sent as the join sends it (flow 61).
// Run by Maestro (runScript), which provides http.
const query = typeof TYPE !== 'undefined' && TYPE === 'member_joined'
  ? '&type=member_joined&project=' + encodeURIComponent(PROJECT) + '&member=' + encodeURIComponent(MEMBER)
  : '&count=' + COUNT + '&title=' + encodeURIComponent(TITLE);
const response = http.get(MAIL_URL + '/notify?to=' + encodeURIComponent(EMAIL) + query);
if (!response.ok) throw new Error('notify answered ' + response.status + ': ' + response.body);
