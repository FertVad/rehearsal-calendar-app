// Sends every answer hold-answers.js held back, and holds no more.
// Run by Maestro (runScript), which provides http and json.
// ${EXPECT}, when given, is how many answers must have been held: a flow whose
// point is a late answer fails if there was none (flow 38).
const response = http.get(MAIL_URL + '/release');
if (!response.ok) throw new Error('release answered ' + response.status + ': ' + response.body);
if (typeof EXPECT !== 'undefined' && json(response.body).released !== Number(EXPECT)) {
  throw new Error('released ' + json(response.body).released + ' answers, not ' + EXPECT);
}
