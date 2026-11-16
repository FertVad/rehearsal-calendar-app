// Makes ${MEMBER} (an address) ${ROLE} ("admin" or "member") of the project
// named ${PROJECT} through the local server's API, as its owner ${EMAIL} would
// from another device: signed in on its own, then the role changed on the
// member's row (flows 75, 76, 77).
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
const project = call('GET', '/native/projects', token).projects.find(function (p) { return p.name === PROJECT; });
if (!project) throw new Error(EMAIL + ' runs no project named ' + PROJECT);
const member = call('GET', '/native/projects/' + project.id + '/members', token).members
  .find(function (m) { return m.email === MEMBER; });
if (!member) throw new Error(MEMBER + ' is not in ' + PROJECT);
call('PUT', '/native/projects/' + project.id + '/members/' + member.userId + '/role', token, { role: ROLE });
