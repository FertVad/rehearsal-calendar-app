// Stops Safari on the simulator ${SIMULATOR} and empties its data container,
// so its next launch restores no tab (e2e/subflows/fresh-safari.yaml, T-404).
// Run by Maestro (runScript), which provides http and json.
const response = http.get(MAIL_URL + '/fresh-safari?device=' + encodeURIComponent(SIMULATOR));
if (!response.ok) throw new Error('fresh-safari answered ' + response.status + ': ' + response.body);
