// Puts ${TEXT} on the pasteboard of the simulator ${SIMULATOR}, as copying it
// in another app would, for a flow that pastes with iOS's own paste control
// (flow 08). Maestro's setClipboard keeps the text to itself, for its
// pasteText; the control reads the system's pasteboard.
// Run by Maestro (runScript), which provides http and json.
const response = http.get(MAIL_URL + '/pasteboard?device=' + encodeURIComponent(SIMULATOR)
  + '&text=' + encodeURIComponent(TEXT));
if (!response.ok) throw new Error('pasteboard answered ' + response.status + ': ' + response.body);
