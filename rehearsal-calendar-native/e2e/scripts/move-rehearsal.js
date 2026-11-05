// Moves the rehearsal ${REHEARSAL} (an id) ${HOURS} hours later through the
// local server's API, as its admin ${EMAIL} would from another device: signed
// in on its own, saving the same title and place at the new time (flow 73).
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
const later = (iso) => new Date(new Date(iso).getTime() + Number(HOURS) * 3600000).toISOString();
call('PUT', '/native/projects/' + rehearsal.projectId + '/rehearsals/' + REHEARSAL, token, {
  title: rehearsal.title,
  description: rehearsal.description,
  location: rehearsal.location,
  startsAt: later(rehearsal.startsAt),
  endsAt: later(rehearsal.endsAt),
});
