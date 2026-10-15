// Sends every answer hold-answers.js held back, and holds no more.
// Run by Maestro (runScript), which provides http.
const response = http.get(MAIL_URL + '/release');
if (!response.ok) throw new Error('release answered ' + response.status + ': ' + response.body);
