// The preview video's recorder (e2e/store/record.mjs, T-275), asked by
// video.yaml: ${ACTION} "start" a recording of shot ${CLIP} of the simulator
// ${SIMULATOR}, "stop" it, "wait" ${MS} ms — a person's pause, which Maestro
// has no command for — "mark" the moment ${NAME} in the recording under way
// (T-286; "cut" and "resume" take out what is between them, T-289), or
// "light" ${NAME}: read where ${HOLES} are on the screen now, from the
// hierarchy of app ${APP} (T-289) — or, with ${AFTER} "up", ${MS} ms after
// the next finger lifts, answering at once so the flow can make that tap.
// Each answers once it is done: recording begun, the file whole, the time
// gone, the moment kept, the frames read.
// Run by Maestro (runScript), which provides http.
const RECORDER = 'http://127.0.0.1:3003';
let route;
if (ACTION === 'start') route = '/start?clip=' + encodeURIComponent(CLIP) + '&device=' + encodeURIComponent(SIMULATOR);
else if (ACTION === 'stop') route = '/stop';
else if (ACTION === 'wait') route = '/wait?ms=' + encodeURIComponent(MS);
else if (ACTION === 'mark') route = '/mark?name=' + encodeURIComponent(NAME);
else if (ACTION === 'light') route = '/light?name=' + encodeURIComponent(NAME) + '&holes=' + encodeURIComponent(HOLES) + '&app=' + encodeURIComponent(APP)
  + (typeof AFTER !== 'undefined' && AFTER ? '&after=' + encodeURIComponent(AFTER) + '&ms=' + encodeURIComponent(MS) : '');
else throw new Error('recorder.js: no action ' + ACTION);
const response = http.get(RECORDER + route);
if (!response.ok) throw new Error('the recorder answered ' + response.status + ' to ' + route + ': ' + response.body);
