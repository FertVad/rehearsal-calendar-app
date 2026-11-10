// Fails if text is cut on the screenshot ${SHOT} within ${LEFT}-${RIGHT} and
// ${TOP}-${BOTTOM} of the screen (fractions): a "…" drawn in place of what
// did not fit (ink.mjs; flow 59, T-241). Maestro reads a label whole however
// much of it is drawn, so the cut is looked for where it is drawn.
// Run by Maestro (runScript), which provides http and json.
const response = http.get(MAIL_URL + '/ellipses?shot=' + encodeURIComponent(SHOT)
  + '&left=' + LEFT + '&right=' + RIGHT + '&top=' + TOP + '&bottom=' + BOTTOM);
if (!response.ok) throw new Error('ellipses answered ' + response.status + ': ' + response.body);
const found = json(response.body).ellipses;
if (found.length) {
  throw new Error(SHOT + ': text cut, "…" at ' + found.map((e) => e.left + ',' + e.top + ' pt').join('; '));
}
console.log(SHOT + ': no text cut there');
