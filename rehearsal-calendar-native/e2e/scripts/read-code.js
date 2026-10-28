// Reads the code in the latest email the local server sent to ${TO}, from the
// e2e mailbox at ${MAIL_URL} (server-with-mailbox.mjs), into ${output.<NAME>}.
// Run by Maestro (runScript), which provides http, json and output.
const response = http.get(MAIL_URL + '/code?to=' + encodeURIComponent(TO));
if (!response.ok) throw new Error('No code mailed to ' + TO + ': ' + response.status + ' ' + response.body);
output[NAME] = json(response.body).code;
