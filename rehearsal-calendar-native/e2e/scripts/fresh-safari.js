// Asks the runner's helper to stop Safari on the simulator ${SIMULATOR} and
// remove the simulator's Library/Safari/SafariTabs.db (and BrowserState.db),
// so its next launch restores no tab (e2e/subflows/fresh-safari.yaml, T-404).
// The helper answers 500, and this script fails the flow, when Safari is not
// known to be stopped; then nothing is removed (e2e/safari.mjs, T-405).
// Run by Maestro (runScript), which provides http and json.
const response = http.get(MAIL_URL + '/fresh-safari?device=' + encodeURIComponent(SIMULATOR));
if (!response.ok) throw new Error('fresh-safari answered ' + response.status + ': ' + response.body);
