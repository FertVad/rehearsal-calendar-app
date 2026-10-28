// Marks ${DAY} free all day for ${EMAIL} through the local server's API, the
// way another device of theirs would: signed in on its own, saving that one day.
// Run by Maestro (runScript), which provides http and json.
function call(method, route, token, body) {
  const response = http.request(API_URL + route, {
    method: method,
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(method + ' ' + route + ' answered ' + response.status + ': ' + response.body);
  return json(response.body);
}

const token = call('POST', '/auth/login', null, { email: EMAIL, password: PASSWORD }).accessToken;
call('PUT', '/native/availability/days', token, {
  days: [{ date: DAY, entries: [{ startsAt: DAY + 'T00:00:00.000Z', endsAt: DAY + 'T23:59:59.999Z', type: 'available', isAllDay: true }] }],
});
