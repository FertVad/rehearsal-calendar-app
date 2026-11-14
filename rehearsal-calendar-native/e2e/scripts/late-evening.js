// Moves ${EMAIL}'s profile to a zone where it is late in the evening now —
// from 22:45 to 23:44 — and puts that zone's today in `output.lateDay`
// (YYYY-MM-DD), through the local server's API, as the profile's zone picker
// saves it (flow 92, T-256). The planner's working day ends at 23:00 and today
// offers no half-hour already begun, so a period of that one day has no hour
// at all: the planner's empty state, which no week can reach. Picked when the
// flow runs, not in the seed: the whole set runs for most of an hour after it.
// The zone is a whole-hour Etc/GMT one, which the server takes (isTimeZone):
// at least a quarter of an hour before that day ends, for a flow of minutes.
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

const now = new Date();
const hour = now.getUTCMinutes() < 45 ? 23 : 22;
let offset = hour - now.getUTCHours();
if (offset > 14) offset -= 24;
if (offset < -12) offset += 24;
// Etc/GMT's sign is POSIX's: Etc/GMT-3 is three hours ahead of UTC.
const zone = offset === 0 ? 'Etc/GMT' : 'Etc/GMT' + (offset > 0 ? '-' : '+') + Math.abs(offset);
const there = new Date(now.getTime() + offset * 3600000);
const pad = function (n) { return (n < 10 ? '0' : '') + n; };

const token = call('POST', '/auth/login', null, { email: EMAIL, password: PASSWORD }).accessToken;
call('PUT', '/auth/me', token, { timezone: zone });
output.lateDay = there.getUTCFullYear() + '-' + pad(there.getUTCMonth() + 1) + '-' + pad(there.getUTCDate());
console.log(EMAIL + ' now in ' + zone + ', ' + pad(there.getUTCHours()) + ':' + pad(there.getUTCMinutes()) + ' on ' + output.lateDay);
