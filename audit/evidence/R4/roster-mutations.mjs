// R4 roster rule (D01, D02): put each weakening of the rule back into a copy of
// the server and require the test that guards it to fail — in Jest, and on
// PostgreSQL where the route reaches it. The unmutated copy must pass both. A
// Jest expectation names a failed test ("●"); a copy that fails to load its
// modules is refused (loadFailure).
//
//   node audit/evidence/R4/roster-mutations.mjs
//
// Needs Node 22, Docker Desktop (desktop-linux) with postgres:15, as the R0 harness.
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const server = path.resolve(fileURLToPath(new URL('../../../rehearsal-calendar-native/server', import.meta.url)));
const ROSTER = 'services/rehearsals/roster.js';
const ROUTES = 'routes/native/rehearsals.js';
const jest = ['--experimental-vm-modules', 'node_modules/jest/bin/jest.js', '--runInBand', '--silent',
  '__tests__/routes/rehearsalRoster.test.js', '__tests__/integration/rsvpService.integration.test.js',
  '__tests__/integration/reminderScheduler.integration.test.js'];
const pg = ['scripts/r0-postgres.mjs', '--r4-only'];

function edit(root, file, from, to) {
  const target = path.join(root, file);
  const text = readFileSync(target, 'utf8');
  assert.equal(text.split(from).length, 2, `mutation anchor must occur once: ${from.slice(0, 60)}`);
  writeFileSync(target, text.replace(from, () => to));
}

const mutations = [
  { id: 'control', description: 'unmutated copy', runs: [jest, pg], expect: 'pass' },
  { id: 'members-unchecked', description: 'the participant list is not checked against the project (D01)',
    apply: (root) => edit(root, ROSTER, 'const found = new Set(members.map((row) => Number(row.user_id)));',
      'const found = new Set(ids);'),
    runs: [jest, pg], expect: /● .*refuses a list naming someone outside the project, before writing anything/ },
  { id: 'list-trimmed', description: 'strangers are dropped from the list instead of refusing it (D01)',
    apply: (root) => {
      edit(root, ROSTER, '  if (unknown.length > 0) {\n', '  if (false) {\n');
      edit(root, ROSTER, '  return ids;\n}\n\n/**\n * Make the roster exactly',
        '  return ids.filter((id) => found.has(id));\n}\n\n/**\n * Make the roster exactly');
    },
    runs: [jest, pg], expect: /● .*refuses a list naming someone outside the project, before writing anything/ },
  { id: 'answer-upserts', description: 'an answer puts its author on the rehearsal (D02)',
    apply: (root) => edit(root, ROSTER, `  if (!(await placeOnRoster(conn, rehearsalId, userId))) {
    throw new RosterRefused(403, 'NOT_ON_REHEARSAL', 'You are not on this rehearsal');
  }
  await conn.run(
    \`UPDATE native_rehearsal_responses SET response = $3, notes = $4, updated_at = NOW()
     WHERE rehearsal_id = $1 AND user_id = $2\`,`, `  await conn.run(
    \`INSERT INTO native_rehearsal_responses (rehearsal_id, user_id, response, notes)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (rehearsal_id, user_id) DO UPDATE SET response = $3, notes = $4, updated_at = NOW()\`,`),
    runs: [jest], expect: /● .*an admin who is not on it is told so and stays off it/ },
  { id: 'respond-unguarded', description: 'the answer route does not ask whether the caller may see the rehearsal (D02)',
    apply: (root) => edit(root, ROUTES, `    if (!(await viewerOf(db, rehearsal, userId))) {
      return res.status(404).json({ error: 'Rehearsal not found' });
    }

    const stats = await respondToRehearsal(`, '    const stats = await respondToRehearsal('),
    runs: [jest, pg], expect: /● .*a member not on the rehearsal cannot put themselves on it/ },
  { id: 'cast-open-to-project', description: 'the cast of a rehearsal is shown to project members not on it',
    apply: (root) => edit(root, ROUTES, `    if (!(await viewerOf(db, rehearsal, userId))) {
      return res.status(404).json({ error: 'Rehearsal not found' });
    }

    const result = await getRehearsalResponses(rehearsalId);`, '    const result = await getRehearsalResponses(rehearsalId);'),
    runs: [jest, pg], expect: /● .*hides it from a member who is not on the rehearsal/ },
  { id: 'roster-ignores-membership', description: 'a leftover row of someone who has left counts as being on it',
    apply: (root) => edit(root, ROSTER, `  JOIN native_project_members roster_member ON roster_member.project_id = roster_rehearsal.project_id
    AND roster_member.user_id = rr.user_id AND roster_member.status = 'active'
`, ''),
    runs: [jest, pg], expect: /● .*leaves someone who has left out of the change announcement and the busy slots/ },
  { id: 'table-outside-module', description: 'another module reads the roster table directly',
    apply: (root) => edit(root, 'routes/native/members.js', '    await takeOffProjectRehearsals(db, projectId, userId);\n',
      "    await takeOffProjectRehearsals(db, projectId, userId);\n    await db.run('DELETE FROM native_rehearsal_responses WHERE user_id = $1 AND FALSE', [userId]);\n"),
    runs: [jest], expect: /● .*no server code outside the roster module touches the roster table/ },
];

const results = [];
for (const mutation of mutations) {
  const parent = mkdtempSync(path.join(process.env.TMPDIR || tmpdir(), `r4-roster-mutation-${mutation.id}-`));
  const root = path.join(parent, 'server');
  try {
    cpSync(server, root, { recursive: true, filter: (source) => !source.includes(`${path.sep}node_modules`)
      && path.basename(source) !== '.env' });
    symlinkSync(path.join(server, 'node_modules'), path.join(root, 'node_modules'));
    symlinkSync(path.join(server, '..', 'shared'), path.join(parent, 'shared'));
    if (mutation.apply) mutation.apply(root);
    const outputs = [];
    const detail = [];
    let failed = false;
    for (const args of mutation.runs) {
      const started = Date.now();
      const run = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 300000,
        maxBuffer: 16 * 1024 * 1024, env: { PATH: process.env.PATH, HOME: process.env.HOME } });
      const output = `${run.stdout}\n${run.stderr}`;
      outputs.push(output);
      if (run.status !== 0) failed = true;
      detail.push({ run: args.at(-1), exit: run.status, seconds: Math.round((Date.now() - started) / 100) / 10,
        passedPg: (output.match(/REGRESSION PASS/) || [null])[0],
        firstFailure: (output.split('\n').find((line) => /●|AssertionError|Expected|!==/.test(line)) || '').trim().slice(0, 160) || null });
    }
    const output = outputs.join('\n');
    const loadFailure = /does not provide an export named|Test suite failed to run|Cannot find module/.test(output);
    const caught = mutation.expect === 'pass' ? !failed : failed && !loadFailure && mutation.expect.test(output);
    results.push(caught);
    console.log(JSON.stringify({ mutation: mutation.id, description: mutation.description,
      detail, suitesFailed: failed, loadFailure,
      expected: mutation.expect === 'pass' ? 'all pass' : 'guard test fails', result: caught ? 'PASS' : 'FAIL' }));
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}
const failures = results.filter((ok) => !ok).length;
console.log(JSON.stringify({ summary: failures ? 'FAIL' : 'PASS', mutations: results.length, failures }));
process.exitCode = failures ? 1 : 0;
