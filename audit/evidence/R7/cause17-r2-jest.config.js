// The client's frontend Jest project with ts-jest's type diagnostics off, for
// the red-before run of cause fix 17, second round: the new tests call
// syncAllRehearsals with the pass's options, which the reviewed code's type
// does not have yet, and the run should fail on behaviour, not on the type.
//   npx jest -c ../audit/evidence/R7/cause17-r2-jest.config.js --runTestsByPath ...
const path = require('path');
const base = require('../../../rehearsal-calendar-native/jest.config.js');

const frontend = base.projects.find((p) => p.displayName === 'frontend');
const [pattern, [tsJest, options]] = Object.entries(frontend.transform)[0];

module.exports = {
  ...frontend,
  rootDir: path.resolve(__dirname, '../../../rehearsal-calendar-native'),
  transform: { [pattern]: [tsJest, { ...options, diagnostics: false }] },
};
