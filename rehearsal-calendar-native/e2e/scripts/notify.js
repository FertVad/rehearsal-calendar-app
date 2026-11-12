// ${COUNT} new notifications for ${EMAIL}, titled "${TITLE} 1" (the oldest) to
// "${TITLE} ${COUNT}", recorded as the server records them while the app is
// open — what a busy week of changes would leave (server-with-mailbox.mjs).
// With TYPE "member_joined": one "New member" about the project named
// ${PROJECT}, ${MEMBER} having joined it, sent as the join sends it (flow 61).
// With TYPE "role_changed" or "member_removed": the notice of ${ROLE} given
// ("admin" if none) or of being removed from ${PROJECT}, and only the notice
// (flow 86).
// With TYPE "rehearsal_updated" or "member_response": the rehearsal titled
// ${REHEARSAL} changed (${CHANGE}, "location" if none) or marked seen by
// ${MEMBER}, sent as an edit and a "seen" send it (flow 62).
// With TYPE "rehearsal_created", "added_to_rehearsal" or "rehearsal_deleted":
// the rehearsal titled ${REHEARSAL} new, ${EMAIL} put on it, or cancelled, as
// a save and a delete send it (flow 86).
// Run by Maestro (runScript), which provides http.
const type = typeof TYPE !== 'undefined' ? TYPE : '';
const query = type === 'member_joined'
  ? '&type=member_joined&project=' + encodeURIComponent(PROJECT) + '&member=' + encodeURIComponent(MEMBER)
  : type === 'role_changed' || type === 'member_removed'
    ? '&type=' + type + '&project=' + encodeURIComponent(PROJECT)
      + (type === 'role_changed' ? '&role=' + encodeURIComponent(typeof ROLE !== 'undefined' ? ROLE : 'admin') : '')
    : type === 'rehearsal_updated'
      ? '&type=rehearsal_updated&rehearsal=' + encodeURIComponent(REHEARSAL)
        + '&change=' + encodeURIComponent(typeof CHANGE !== 'undefined' ? CHANGE : 'location')
      : type === 'member_response'
        ? '&type=member_response&rehearsal=' + encodeURIComponent(REHEARSAL) + '&member=' + encodeURIComponent(MEMBER)
        : type === 'rehearsal_created' || type === 'added_to_rehearsal' || type === 'rehearsal_deleted'
          ? '&type=' + type + '&rehearsal=' + encodeURIComponent(REHEARSAL)
          : '&count=' + COUNT + '&title=' + encodeURIComponent(TITLE);
const response = http.get(MAIL_URL + '/notify?to=' + encodeURIComponent(EMAIL) + query);
if (!response.ok) throw new Error('notify answered ' + response.status + ': ' + response.body);
