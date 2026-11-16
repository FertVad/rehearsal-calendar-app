// Fails if text is cut on the screenshot ${SHOT} within ${LEFT}-${RIGHT} and
// ${TOP}-${BOTTOM} of the screen (fractions): a "…" drawn in place of what
// did not fit (ink.mjs; flow 59, T-241). Maestro reads a label whole however
// much of it is drawn, so the cut is looked for where it is drawn.
// ${RECORD}, when given, is a name: the cut is not a failure then but goes in
// `output.<RECORD>` (empty when nothing is cut), for a flow that names every
// wrong word at its end rather than stopping at the first (T-256).
// Run by Maestro (runScript), which provides http and json.
const response = http.get(MAIL_URL + '/ellipses?shot=' + encodeURIComponent(SHOT)
  + '&left=' + LEFT + '&right=' + RIGHT + '&top=' + TOP + '&bottom=' + BOTTOM);
if (!response.ok) throw new Error('ellipses answered ' + response.status + ': ' + response.body);
const found = json(response.body).ellipses;
const cut = found.length
  ? SHOT + ': text cut, "…" at ' + found.map((e) => e.left + ',' + e.top + ' pt').join('; ')
  : '';
if (typeof RECORD !== 'undefined') {
  output[RECORD] = cut;
} else if (cut) {
  throw new Error(cut);
}
console.log(SHOT + ': ' + (cut || 'no text cut there'));
