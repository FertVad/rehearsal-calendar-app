// Asks the runner's helper to open ${LINK} in a fresh Safari on the simulator
// ${SIMULATOR} that Maestro can read: Safari stopped, its tabs removed, the
// link opened with simctl openurl, and the Safari it launched checked readable
// in the device log - one that came up with its home directory inaccessible is
// stopped and the link opened again (e2e/subflows/open-in-safari.yaml, T-431).
// The helper answers 500, and this script fails the flow, when it cannot.
// Run by Maestro (runScript), which provides http and json.
const response = http.get(MAIL_URL + '/open-in-safari?device=' + encodeURIComponent(SIMULATOR)
  + '&link=' + encodeURIComponent(LINK));
if (!response.ok) throw new Error('open-in-safari answered ' + response.status + ': ' + response.body);
