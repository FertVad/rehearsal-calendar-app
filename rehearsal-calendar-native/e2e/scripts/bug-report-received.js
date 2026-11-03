// The server stored a bug report from ${EMAIL} with the text ${MESSAGE}, sent
// from the screen ${SCREEN} — what the admin dashboard lists
// (server-with-mailbox.mjs). Run by Maestro (runScript), which provides http
// and json.
const response = http.get(MAIL_URL + '/bug-reports?from=' + encodeURIComponent(EMAIL));
if (!response.ok) throw new Error('bug-reports answered ' + response.status + ': ' + response.body);
const reports = json(response.body).reports;
const found = reports.filter(function (report) { return report.message === MESSAGE; });
if (found.length !== 1) throw new Error(found.length + ' reports "' + MESSAGE + '" from ' + EMAIL + ': ' + response.body);
if (found[0].screen !== SCREEN) throw new Error('the report came from "' + found[0].screen + '", not "' + SCREEN + '"');
