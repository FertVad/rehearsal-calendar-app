// Puts ${MEMBER} (a full name, as the members list shows it) on the rehearsal
// ${REHEARSAL} (an id) through the local server's API, as its project's admin
// ${EMAIL} would from another device: signed in on its own, saving the
// rehearsal as it is with one more person on it — the cast it already has
// kept, and nothing else changed (flow 79, T-233). By name, not by address:
// the list gives nobody the others' addresses (T-273).
// Run by Maestro (runScript), which provides http and json.
function call(method, route, token, body) {
  const response = http.request(API_URL + route, {
    method: method,
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(method + ' ' + route + ' answered ' + response.status + ': ' + response.body);
  return json(response.body);
}

const token = call('POST', '/auth/login', null, { email: EMAIL, password: PASSWORD }).accessToken;
const rehearsal = call('GET', '/native/rehearsals/' + REHEARSAL, token).rehearsal;
const named = call('GET', '/native/projects/' + rehearsal.projectId + '/members', token).members
  .filter(function (m) { return [m.firstName, m.lastName].filter(Boolean).join(' ') === MEMBER; });
if (named.length !== 1) {
  throw new Error('The project of rehearsal ' + REHEARSAL + ' has ' + named.length + ' members named ' + MEMBER);
}
const member = named[0];
const cast = call('GET', '/native/rehearsals/' + REHEARSAL + '/responses', token).responses
  .map(function (r) { return String(r.userId); });
if (cast.indexOf(String(member.userId)) !== -1) throw new Error(MEMBER + ' is on rehearsal ' + REHEARSAL + ' already');
call('PUT', '/native/projects/' + rehearsal.projectId + '/rehearsals/' + REHEARSAL, token, {
  title: rehearsal.title,
  description: rehearsal.description,
  location: rehearsal.location,
  startsAt: rehearsal.startsAt,
  endsAt: rehearsal.endsAt,
  participant_ids: cast.concat([String(member.userId)]),
});
