// From now on the local server holds back its answers to ${METHOD} requests
// whose path matches ${PATH} (a regular expression), until release-answers.js
// — each answer nine seconds at most, the hold a minute at most
// (server-with-mailbox.mjs). What a slow network does to one
// request and not to the next. Run by Maestro (runScript), which provides http.
const response = http.get(MAIL_URL + '/hold?method=' + METHOD + '&path=' + encodeURIComponent(PATH));
if (!response.ok) throw new Error('hold answered ' + response.status + ': ' + response.body);
