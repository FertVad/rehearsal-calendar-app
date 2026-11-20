// Removes ${MEMBER} (a full name, as the members list shows it) from the
// project named ${PROJECT} through the local server's API, as its owner
// ${EMAIL} would from another device: signed in on its own, then the member's
// row removed (flow 101). The removed one's simulator gets no push, so the page
// he has open stays as it was.
// Run by Maestro (runScript), which provides http and json.
function call(method, route, token, body) {
  const response = http.request(API_URL + route, {
    method: method,
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(method + ' ' + route + ' answered ' + response.status + ': ' + response.body);
  return response.body ? json(response.body) : null;
}

const token = call('POST', '/auth/login', null, { email: EMAIL, password: PASSWORD }).accessToken;
const project = call('GET', '/native/projects', token).projects.find(function (p) { return p.name === PROJECT; });
if (!project) throw new Error(EMAIL + ' runs no project named ' + PROJECT);
const named = call('GET', '/native/projects/' + project.id + '/members', token).members
  .filter(function (m) { return [m.firstName, m.lastName].filter(Boolean).join(' ') === MEMBER; });
if (named.length !== 1) throw new Error(PROJECT + ' has ' + named.length + ' members named ' + MEMBER);
call('DELETE', '/native/projects/' + project.id + '/members/' + named[0].userId, token);
