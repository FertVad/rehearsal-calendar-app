// The preview video's recorder (e2e/store/record.mjs, T-275), asked by
// video.yaml: ${ACTION} "start" a recording of shot ${CLIP} of the simulator
// ${SIMULATOR}, "stop" it, or "wait" ${MS} ms — a person's pause, which Maestro
// has no command for. Each answers once it is done: recording begun, the file
// whole, the time gone. Run by Maestro (runScript), which provides http.
const RECORDER = 'http://127.0.0.1:3003';
let route;
if (ACTION === 'start') route = '/start?clip=' + encodeURIComponent(CLIP) + '&device=' + encodeURIComponent(SIMULATOR);
else if (ACTION === 'stop') route = '/stop';
else if (ACTION === 'wait') route = '/wait?ms=' + encodeURIComponent(MS);
else throw new Error('recorder.js: no action ' + ACTION);
const response = http.get(RECORDER + route);
if (!response.ok) throw new Error('the recorder answered ' + response.status + ' to ' + route + ': ' + response.body);
