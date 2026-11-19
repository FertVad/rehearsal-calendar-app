// The cast marks the rehearsal of all twelve seen (the video's shot 6, T-275),
// each from a phone of their own: through the local server's API, as the app
// sends it. ${EMAILS}: the eleven of the cast, comma-separated; those from
// ${FROM} up to ${TO} (not included) mark rehearsal ${REHEARSAL}. All sign in
// on the first call, outside the shot, so the shot waits for none of it; their
// tokens are kept in `output`. Run by Maestro (runScript): http, json, output.
function call(method, route, token, body) {
  const response = http.request(API_URL + route, {
    method: method,
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(method + ' ' + route + ' answered ' + response.status + ': ' + response.body);
  return json(response.body);
}

if (!output.seenTokens) {
  output.seenTokens = EMAILS.split(',').map(function (email) {
    return call('POST', '/auth/login', null, { email: email, password: PASSWORD }).accessToken;
  });
}
for (let i = Number(FROM); i < Number(TO); i++) {
  call('POST', '/native/rehearsals/' + REHEARSAL + '/respond', output.seenTokens[i], { response: 'yes' });
}
