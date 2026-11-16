// Saves ${ZONE} (an IANA name) as the timezone of ${EMAIL}'s profile through
// the local server's API, as the person would from another device: signed in
// on its own, then the profile saved. The app reads it with the next profile
// it is given - at a start, or in the answer to a change of language (flow 23:
// a zone a phone reports that the picker does not offer, named on the profile).
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
const saved = call('PUT', '/auth/me', token, { timezone: ZONE }).user;
if (!saved || saved.timezone !== ZONE) throw new Error(EMAIL + "'s timezone was not saved as " + ZONE);
