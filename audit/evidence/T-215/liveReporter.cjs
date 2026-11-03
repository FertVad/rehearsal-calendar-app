// T-215: a Jest reporter beside the default one. It prints when
// membersAvailabilityRange.test.js starts, and the moment a test of it ends:
// the first test (the one that failed in the red run) always, any other one
// if it failed, with its status, time and the first line of its failure. The
// verdict is on screen even if the file then stalls past the deadline.
// Copies made for T215_REPEAT (redOrderSequencer.cjs) count as the target.
const target = /server\/__tests__\/routes\/membersAvailabilityRange(\.repeat\d+)?\.test\.js$/;
const started = Date.now();
const at = () => `${((Date.now() - started) / 1000).toFixed(1)} s`;
const name = (test) => test.path.match(target)[0];

class LiveReporter {
  onTestFileStart(test) {
    if (target.test(test.path)) console.log(`LIVE [${at()}] start ${name(test)}`);
  }

  onTestCaseResult(test, result) {
    if (!target.test(test.path)) return;
    if (result.status === 'passed' && !result.title.startsWith('says whether')) return;
    const why = (result.failureMessages[0] || '').split('\n')[0];
    console.log(`LIVE [${at()}] ${result.status} "${result.title}" ${result.duration} ms ${why}`.trim());
  }
}
module.exports = LiveReporter;
