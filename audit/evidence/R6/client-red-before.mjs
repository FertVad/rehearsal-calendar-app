// R6 editor save (cause fix 2), app half: the new tests cannot run against the
// old hooks — their shape changed, so ts-jest refuses to compile the pair. The
// red-before is shown instead by putting each old behaviour back into the new
// code and requiring the test that names it to fail. Control must pass.
//
//   node audit/evidence/R6/client-red-before.mjs
//
// Needs Node 22 and the app's node_modules; no network, no device.
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const app = path.resolve(new URL('../../../rehearsal-calendar-native', import.meta.url).pathname);
const H = 'src/features/availability/hooks/';
const edit = (root, file, from, to) => { const p = path.join(root, file); const s = readFileSync(p, 'utf8');
  assert.equal(s.split(from).length, 2, 'anchor ' + from.slice(0, 50)); writeFileSync(p, s.replace(from, () => to)); };
const cases = [
  ['control', null, null],
  ['CC05 sends every day', (r) => edit(r, H + 'useAvailabilitySave.ts', 'const dates = Object.keys(sent).filter((date) => date >= today).sort();',
    'const dates = Object.keys(availability).filter((date) => date >= today).sort();'), /sends only the changed days, each by name/],
  ['CC03 counters read after the answer', (r) => edit(r, H + 'useAvailabilitySave.ts', '      markSaved(sent);\n', '      markSaved({ ...changed });\n'),
    /marks saved the versions it sent/],
  ['CC02 reload overwrites drafts', (r) => edit(r, H + 'useAvailabilityData.ts', 'setAvailability((current) => keepDrafts(localData, current, changedRef.current));',
    'setAvailability(localData);'), /a reload keeps the days being edited/],
  ['CC02 offline copy overwrites drafts', (r) => edit(r, H + 'useAvailabilityData.ts', 'setAvailability((current) => keepDrafts(loaded, current, changedRef.current));',
    'setAvailability(loaded);'), /keeps them when the reload falls back/],
  ['CC03 save clears newer edits', (r) => edit(r, H + 'useAvailabilityData.ts', '        if (next[date] === version) delete next[date];\n', '        delete next[date];\n'),
    /a save marks saved only the edits it sent/],
  ['CC04 deletes every selected day', (r) => edit(r, H + 'useAvailabilityEditor.ts', 'const dates = selectedDates.filter((date) => date < today);',
    'const dates = [...selectedDates];'), /touches only the past days of a mixed selection/],
  ['edit does not mark its days', (r) => edit(r, H + 'useAvailabilityEditor.ts', `      }))
    );
    markChanged(selectedDates);
  };

  const addSlot`, `      }))
    );
  };

  const addSlot`), /marks the selected days, and only them/],
];
for (const [name, apply, expect] of cases) {
  const parent = mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'r6-client-red-')); const root = path.join(parent, 'app');
  try {
    for (const e of ['src', 'shared', 'jest.config.js', 'package.json', 'tsconfig.json', 'app.json']) cpSync(path.join(app, e), path.join(root, e), { recursive: true });
    symlinkSync(path.join(app, 'node_modules'), path.join(root, 'node_modules'));
    if (apply) apply(root);
    const run = spawnSync(process.execPath, ['node_modules/jest/bin/jest.js', '--selectProjects', 'frontend', '--runInBand', '--silent',
      '--testPathPatterns', 'features/availability'], { cwd: root, encoding: 'utf8', timeout: 300000, maxBuffer: 16 << 20,
      env: { PATH: process.env.PATH, HOME: process.env.HOME } });
    const out = run.stdout + run.stderr;
    const load = /Test suite failed to run/.test(out);
    const ok = expect ? run.status !== 0 && !load && expect.test(out) : run.status === 0;
    console.log(JSON.stringify({ case: name, exit: run.status, load, tests: (out.match(/Tests:\s+[^\n]+/) || [''])[0], result: ok ? 'PASS' : 'FAIL' }));
  } finally { rmSync(parent, { recursive: true, force: true }); }
}
