// From now on the local server holds back its answers to ${METHOD} requests
// whose path matches ${PATH} (a regular expression), until release-answers.js
// — each answer nine seconds at most, the hold a minute at most
// (server-with-mailbox.mjs). What a slow network does to one
// request and not to the next. Run by Maestro (runScript), which provides http.
// ${MS}, when given, is how long each answer waits instead: past ten seconds
// the app gives up on the request, as with no network.
// ${BEFORE}, when "1", holds the request itself: it reaches the server only on
// release, as a change still on its way does.
// ${OPEN}, when "1", holds the request as BEFORE does and keeps its connection
// open until release, so the app does not give up on it however long the flow
// takes.
const wait = typeof MS === 'undefined' ? '' : '&ms=' + MS;
const before = typeof BEFORE === 'undefined' ? '' : '&before=' + BEFORE;
const open = typeof OPEN === 'undefined' ? '' : '&open=' + OPEN;
const response = http.get(MAIL_URL + '/hold?method=' + METHOD + '&path=' + encodeURIComponent(PATH) + wait + before + open);
if (!response.ok) throw new Error('hold answered ' + response.status + ': ' + response.body);
