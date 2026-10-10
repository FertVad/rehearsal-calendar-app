import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pauseReasons, parseDiff, reasonKind, unapproved } from '../lib/guard.mjs';

test('an ordinary client change goes on', () => {
  assert.deepEqual(pauseReasons(
    ['rehearsal-calendar-native/src/features/calendar/components/RehearsalCard.tsx'],
    ['  const label = t.common.edit;']), []);
});

test('migrations, auth, .env, deploy and the supervisor itself pause', () => {
  const reasons = pauseReasons([
    'rehearsal-calendar-native/server/migrations/012-x.sql',
    'rehearsal-calendar-native/server/routes/auth.js',
    'rehearsal-calendar-native/server/.env',
    'rehearsal-calendar-native/server/vercel.json',
    'tools/autodev/supervisor.mjs',
    'rehearsal-calendar-native/ios/Rehearsly/Info.plist',
  ], []);
  assert.equal(reasons.length, 7, reasons.join('\n')); // the migration is also a .sql file
});

test('production addresses, data deletion and keys in added lines pause', () => {
  const reasons = pauseReasons([], [
    "const url = 'https://rehearsly.me/api';",
    'await db.run("DELETE FROM native_users")',
    'DROP TABLE native_notifications;',
    '-----BEGIN PRIVATE KEY-----',
  ]);
  assert.equal(reasons.length, 4, reasons.join('\n'));
});

test('a scoped DELETE is not data deletion', () => {
  assert.deepEqual(pauseReasons([], ["await tx.run('DELETE FROM native_push_tickets WHERE ticket_id = $1', [id])"]), []);
});

test('reads files and added lines from a unified diff', () => {
  const diff = [
    'diff --git a/x/a.ts b/x/a.ts',
    '--- a/x/a.ts',
    '+++ b/x/a.ts',
    '@@ -1 +1,2 @@',
    '-old',
    '+new line',
    '+another',
  ].join('\n');
  assert.deepEqual(parseDiff(diff), { files: ['x/a.ts'], added: ['new line', 'another'] });
});

test('the owner allows a task the kinds of change it stopped on, not a new kind', () => {
  const auth = ['rehearsal-calendar-native/src/contexts/AuthContext.tsx', 'rehearsal-calendar-native/src/features/auth/screens/LoginScreen.tsx'];
  const approved = [...new Set(pauseReasons(auth, []).map(reasonKind))];
  assert.equal(approved.length, 2);
  // The next round changes the same kinds of file again: no new stop.
  assert.deepEqual(unapproved(pauseReasons(auth, []), approved), []);
  // A migration is a kind it has not shown: that still stops, and only that.
  const later = unapproved(pauseReasons([...auth, 'rehearsal-calendar-native/server/migrations/012_x.sql'], []), approved);
  assert.ok(later.length > 0);
  assert.ok(later.every((reason) => /012_x\.sql/.test(reason)), later.join(' | '));
});
