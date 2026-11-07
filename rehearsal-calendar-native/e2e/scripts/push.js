// A push of ${TYPE} about the project named ${PROJECT} (with ${ROLE}, for
// "role_changed"), delivered to ${APP_ID} on the simulator ${SIMULATOR} through
// the mailbox's `xcrun simctl push`: a simulator gets nothing from Expo, and
// the push is what the server's own would carry (flow 75).
// Run by Maestro (runScript), which provides http.
const response = http.get(MAIL_URL + '/push?device=' + encodeURIComponent(SIMULATOR)
  + '&app=' + encodeURIComponent(APP_ID) + '&type=' + encodeURIComponent(TYPE)
  + '&project=' + encodeURIComponent(PROJECT)
  + '&role=' + encodeURIComponent(typeof ROLE !== 'undefined' ? ROLE : 'admin'));
if (!response.ok) throw new Error('push answered ' + response.status + ': ' + response.body);
