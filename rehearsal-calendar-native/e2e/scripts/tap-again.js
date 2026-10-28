// Tells the run that tap-and-see.yaml is taking a tap again (TAP), its result
// (SEE) not on screen after the first: the run prints each one (T-207).
// Run by Maestro (runScript), which provides http.
const response = http.get(MAIL_URL + '/tap-again?tap=' + encodeURIComponent(TAP) + '&see=' + encodeURIComponent(SEE));
if (!response.ok) throw new Error('tap-again answered ' + response.status + ': ' + response.body);
