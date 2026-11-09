// From now on the local server holds back its answers to ${METHOD} requests
// whose path matches ${PATH} (a regular expression), until release-answers.js
// — each answer nine seconds at most, the hold a minute at most
// (server-with-mailbox.mjs). What a slow network does to one
// request and not to the next. Run by Maestro (runScript), which provides http.
// ${MS}, when given, is how long each answer waits instead, for an answer the
// flow releases late. Past ten seconds iOS may give up on the silence, or may
// not (T-220): no flow counts on it giving up; for a request that must fail,
// DROP.
// ${BEFORE}, when "1", holds the request itself: it reaches the server only on
// release, as a change still on its way does.
// ${OPEN}, when "1", holds the request as BEFORE does and keeps its connection
// open until release, so the app does not give up on it however long the flow
// takes.
// ${ONCE}, when "1", holds only the next matching request; the ones after it
// go through.
// ${DROP}, when "1", answers nothing: the server closes the request's
// connection at once, as when the network goes, and the request fails then.
// With BEFORE, the request waits and its connection is closed on release (or
// when MS lapses): it fails late, when the flow says.
// ${LOSE}, when "1", lets the server handle the request and loses its answer:
// the connection is closed instead, so the change is made and the app's
// request fails.
const wait = typeof MS === 'undefined' ? '' : '&ms=' + MS;
const before = typeof BEFORE === 'undefined' ? '' : '&before=' + BEFORE;
const open = typeof OPEN === 'undefined' ? '' : '&open=' + OPEN;
const once = typeof ONCE === 'undefined' ? '' : '&once=' + ONCE;
const drop = typeof DROP === 'undefined' ? '' : '&drop=' + DROP;
// ${DEAD}, when "1", changes the network under the app at the matching
// request: its connection and every other one the app has open go silent —
// read, never answered, never closed — and a new connection is answered as
// usual (T-240).
const lose = typeof LOSE === 'undefined' ? '' : '&lose=' + LOSE;
const dead = typeof DEAD === 'undefined' ? '' : '&dead=' + DEAD;
const response = http.get(MAIL_URL + '/hold?method=' + METHOD + '&path=' + encodeURIComponent(PATH) + wait + before + open + once + drop + lose + dead);
if (!response.ok) throw new Error('hold answered ' + response.status + ': ' + response.body);
