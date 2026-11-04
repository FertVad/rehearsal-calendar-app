// Fails unless the icon in ${COLOUR} ('#rrggbb') on the screenshot ${SHOT},
// within ${LEFT}-${RIGHT} and ${TOP}-${BOTTOM} of the screen (fractions), is
// drawn at least ${MIN_WIDTH} wide or ${MIN_HEIGHT} tall, in points — what
// Maestro cannot see, the glyph inside a 44-point target (ink.mjs, flow 62).
// ${MAX_WIDTH} and ${MAX_HEIGHT}, if given, bound it from above: all of that
// colour there is one thing that size (flow 71, today's ring and nothing
// else purple). "In that colour" is within 40 a channel; ${TOLERANCE}, if
// given, narrows it to tell two close colours apart (#A855F7 from #9333EA).
// Run by Maestro (runScript), which provides http and json.
const response = http.get(MAIL_URL + '/ink?shot=' + encodeURIComponent(SHOT)
  + '&colour=' + encodeURIComponent(COLOUR)
  + '&left=' + LEFT + '&right=' + RIGHT + '&top=' + TOP + '&bottom=' + BOTTOM
  + (typeof TOLERANCE === 'undefined' ? '' : '&tolerance=' + TOLERANCE));
if (!response.ok) throw new Error('ink answered ' + response.status + ': ' + response.body);
const box = json(response.body).box;
if (!box) throw new Error('nothing in ' + COLOUR + ' on ' + SHOT + ' there');
const said = SHOT + ': ' + COLOUR + ' drawn ' + box.width + ' x ' + box.height + ' pt';
console.log(said);
if (typeof MIN_WIDTH !== 'undefined' && box.width < Number(MIN_WIDTH)) throw new Error(said + ', narrower than ' + MIN_WIDTH);
if (typeof MIN_HEIGHT !== 'undefined' && box.height < Number(MIN_HEIGHT)) throw new Error(said + ', shorter than ' + MIN_HEIGHT);
if (typeof MAX_WIDTH !== 'undefined' && box.width > Number(MAX_WIDTH)) throw new Error(said + ', wider than ' + MAX_WIDTH);
if (typeof MAX_HEIGHT !== 'undefined' && box.height > Number(MAX_HEIGHT)) throw new Error(said + ', taller than ' + MAX_HEIGHT);
