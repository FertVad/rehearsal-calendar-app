// ${COUNT} new notifications for ${EMAIL}, titled "${TITLE} 1" (the oldest) to
// "${TITLE} ${COUNT}", recorded as the server records them while the app is
// open — what a busy week of changes would leave (server-with-mailbox.mjs).
// With TYPE "member_joined": one "New member" about the project named
// ${PROJECT}, ${MEMBER} having joined it, sent as the join sends it (flow 61).
// With TYPE "rehearsal_updated" or "member_response": the rehearsal titled
// ${REHEARSAL} changed (${CHANGE}, "location" if none) or answered by
// ${MEMBER}, sent as an edit and a "yes" send it (flow 62).
// Run by Maestro (runScript), which provides http.
const type = typeof TYPE !== 'undefined' ? TYPE : '';
const query = type === 'member_joined'
  ? '&type=member_joined&project=' + encodeURIComponent(PROJECT) + '&member=' + encodeURIComponent(MEMBER)
  : type === 'rehearsal_updated'
    ? '&type=rehearsal_updated&rehearsal=' + encodeURIComponent(REHEARSAL)
      + '&change=' + encodeURIComponent(typeof CHANGE !== 'undefined' ? CHANGE : 'location')
    : type === 'member_response'
      ? '&type=member_response&rehearsal=' + encodeURIComponent(REHEARSAL) + '&member=' + encodeURIComponent(MEMBER)
      : '&count=' + COUNT + '&title=' + encodeURIComponent(TITLE);
const response = http.get(MAIL_URL + '/notify?to=' + encodeURIComponent(EMAIL) + query);
if (!response.ok) throw new Error('notify answered ' + response.status + ': ' + response.body);
