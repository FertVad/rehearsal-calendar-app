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
  assert.deepEqual(parseDiff(diff), { files: ['x/a.ts'], added: ['new line', 'another'],
    changes: { 'x/a.ts': { added: ['new line', 'another'], removed: ['old'] } } });
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

test('app files changed only by testIDs are not a reason; anything more still is', () => {
  const diff = [
    'diff --git a/rehearsal-calendar-native/src/features/auth/screens/LoginScreen.tsx b/rehearsal-calendar-native/src/features/auth/screens/LoginScreen.tsx',
    '--- a/rehearsal-calendar-native/src/features/auth/screens/LoginScreen.tsx',
    '+++ b/rehearsal-calendar-native/src/features/auth/screens/LoginScreen.tsx',
    '@@ -10,0 +11 @@',
    '+              testID="login-forgot-password"',
    'diff --git a/rehearsal-calendar-native/src/features/profile/screens/ChangeEmailScreen.tsx b/rehearsal-calendar-native/src/features/profile/screens/ChangeEmailScreen.tsx',
    '--- a/rehearsal-calendar-native/src/features/profile/screens/ChangeEmailScreen.tsx',
    '+++ b/rehearsal-calendar-native/src/features/profile/screens/ChangeEmailScreen.tsx',
    '@@ -5 +5 @@',
    '-          <Text style={styles.hint}>{subtitle}</Text>',
    '+          <Text testID="change-subtitle" style={styles.hint}>{subtitle}</Text>',
  ].join('\n');
  const { files, added, changes } = parseDiff(diff);
  assert.deepEqual(pauseReasons(files, added, changes), []);
  // A testID and a change of what the button does: that is a reason.
  const more = diff + '\n' + [
    'diff --git a/rehearsal-calendar-native/src/contexts/AuthContext.tsx b/rehearsal-calendar-native/src/contexts/AuthContext.tsx',
    '--- a/rehearsal-calendar-native/src/contexts/AuthContext.tsx',
    '+++ b/rehearsal-calendar-native/src/contexts/AuthContext.tsx',
    '@@ -7 +7 @@',
    '-    await api.logout();',
    '+    await api.logout({ everywhere: true }); // testID="x"',
  ].join('\n');
  const parsed = parseDiff(more);
  const reasons = pauseReasons(parsed.files, parsed.added, parsed.changes);
  assert.equal(reasons.length, 1);
  assert.match(reasons[0], /AuthContext/);
});
