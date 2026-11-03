// Fails if anything is drawn in ${COLOUR} ('#rrggbb') on the screenshot
// ${SHOT}, within ${LEFT}-${RIGHT} and ${TOP}-${BOTTOM} of the screen
// (fractions) - what Maestro cannot see, an icon inside a card that is one
// element (ink.mjs; flow 63, the tick the projects list no longer draws).
// "In that colour" is within 40 a channel; ${TOLERANCE}, if given, narrows it
// to tell two close colours apart (flow 64, #A855F7 from #9333EA).
// Run by Maestro (runScript), which provides http and json.
const response = http.get(MAIL_URL + '/ink?shot=' + encodeURIComponent(SHOT)
  + '&colour=' + encodeURIComponent(COLOUR)
  + '&left=' + LEFT + '&right=' + RIGHT + '&top=' + TOP + '&bottom=' + BOTTOM
  + (typeof TOLERANCE === 'undefined' ? '' : '&tolerance=' + TOLERANCE));
if (!response.ok) throw new Error('ink answered ' + response.status + ': ' + response.body);
const box = json(response.body).box;
if (box) throw new Error(SHOT + ': ' + COLOUR + ' drawn ' + box.width + ' x ' + box.height + ' pt there');
console.log(SHOT + ': nothing in ' + COLOUR + ' there');
