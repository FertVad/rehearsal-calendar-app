// T-215: run the files in the order of the red run, up to and including the
// file that failed, in one in-band process as the checks ran them.
//
//   cd rehearsal-calendar-native && NODE_OPTIONS=--experimental-vm-modules npx jest --runInBand \
//     --testSequencer ../audit/evidence/T-215/redOrderSequencer.cjs --logHeapUsage
//
// The order is read from the red run's checks.log (path in T215_RED_LOG, or its
// copy red-run-checks.log beside this file), whose "PASS|FAIL <project> <path>"
// lines are in run order.
const { readFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const { join } = require('node:path');

const app = join(__dirname, '../../../rehearsal-calendar-native/');
const Sequencer = createRequire(join(app, 'package.json'))('@jest/test-sequencer').default;

const log = process.env.T215_RED_LOG || join(__dirname, 'red-run-checks.log');
const target = 'server/__tests__/routes/membersAvailabilityRange.test.js';

const order = [];
for (const line of readFileSync(log, 'utf8').split('\n')) {
  const m = line.match(/^(?:PASS|FAIL) (?:frontend|backend) (\S+)/);
  if (!m || order.includes(m[1])) continue;
  order.push(m[1]);
  if (m[1] === target) break;
}

// T215_REPEAT=n: n copies of the target, membersAvailabilityRange.repeat<i>.test.js
// (made and removed by late-load-repro.mjs), run right after it.
const repeat = Number(process.env.T215_REPEAT || 0);
for (let i = 1; i <= repeat; i += 1) order.push(target.replace(/\.test\.js$/, `.repeat${i}.test.js`));

class RedOrder extends Sequencer {
  static order = order;

  sort(tests) {
    const rank = (t) => order.findIndex((p) => t.path.endsWith(`/${p}`));
    return tests.filter((t) => rank(t) >= 0).sort((a, b) => rank(a) - rank(b));
  }
}
module.exports = RedOrder;
