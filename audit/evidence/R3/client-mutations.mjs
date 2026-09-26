// R3 client, registration and confirmation: put each weakening the review
// of 164afdb..cc2bc68 found (R3-24..R3-27) back into a copy of the app and
// require the test that guards it to fail. The unmutated copy must pass. A
// variant counts only when the named test fails ("●") and every suite loaded.
//
// There is no whole-file "before" variant: the frontend tests compile with
// ts-jest, and the new tests name translation keys the old files lack, so an
// old file fails to compile rather than to behave — the runner refuses that.
//
//   node audit/evidence/R3/client-mutations.mjs
//
// Needs Node 22 and the app's node_modules; no network, no device.
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = path.resolve(fileURLToPath(new URL('../../../rehearsal-calendar-native', import.meta.url)));
const CONTEXT = 'src/contexts/AuthContext.tsx';
const VERIFY = 'src/features/auth/screens/VerifyEmailScreen.tsx';
const REGISTER = 'src/features/auth/screens/RegisterScreen.tsx';
const jest = ['node_modules/jest/bin/jest.js', '--selectProjects', 'frontend', '--runInBand', '--silent',
  'src/contexts/__tests__/AuthContext.test.tsx', 'src/features/auth/screens/__tests__/VerifyEmailScreen.test.tsx',
  'src/features/auth/screens/__tests__/RegisterScreen.test.tsx', 'src/features/auth/utils/__tests__/authErrors.test.ts'];

function edit(root, file, from, to) {
  const target = path.join(root, file);
  const text = readFileSync(target, 'utf8');
  assert.equal(text.split(from).length, 2, `mutation anchor must occur once: ${from.slice(0, 60)}`);
  writeFileSync(target, text.replace(from, () => to));
}

const mutations = [
  { id: 'control', description: 'unmutated copy', expect: 'pass' },
  // Without the first check the take-back after writing still keeps a late
  // answer from signing in; what it can no longer protect is a newer sign-in's
  // tokens, which the late answer overwrites and then removes.
  { id: 'stale-confirm-writes', description: 'a stale confirmation writes its tokens before looking (R3-24)',
    apply: (root) => edit(root, CONTEXT, `    if (attempt !== signInAttempt.current) return false;
    await AsyncStorage.multiSet([`, '    await AsyncStorage.multiSet(['),
    expect: /● .*does not let a late confirmation replace a newer sign-in/ },
  { id: 'leaving-keeps-attempt', description: 'leaving the flow does not make the attempt in flight stale (R3-24)',
    apply: (root) => edit(root, CONTEXT, `  const forgetPendingSignIn = useCallback(() => {
    signInAttempt.current += 1;
`, `  const forgetPendingSignIn = useCallback(() => {
`),
    expect: /● .*signs nobody in when the confirmation answers after the person left/ },
  { id: 'no-take-back', description: 'tokens written for an attempt that went stale meanwhile stay (R3-24)',
    apply: (root) => edit(root, CONTEXT, `      if ((await AsyncStorage.getItem('accessToken')) === data.accessToken) {
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'cachedUser']);
      }
`, ''),
    expect: /● .*takes back tokens written for an attempt that went stale meanwhile/ },
  { id: 'late-registration-opens', description: 'a registration answered after the form was left still sets the pending address (R3-24)',
    apply: (root) => edit(root, CONTEXT, `      if (!isCurrent(attempt)) return null;
      const created =`, '      const created ='),
    expect: /● .*opens nothing for a registration answered after the form was left/ },
  { id: 'code-screen-keeps-flow', description: 'leaving the code screen by a swipe leaves the confirmation live (R3-24)',
    apply: (root) => edit(root, VERIFY, '  useEffect(() => () => forgetPendingSignIn(), [forgetPendingSignIn]);\n', ''),
    expect: /● .*drops the confirmation when the screen is left any way/ },
  { id: 'form-keeps-registration', description: 'leaving the form leaves the registration live (R3-24)',
    apply: (root) => edit(root, REGISTER, '  useEffect(() => () => forgetPendingSignIn(), [forgetPendingSignIn]);\n', ''),
    expect: /● .*drops a registration in flight when the form is left/ },
  { id: 'loading-during-registration', description: 'registration raises loading again, unmounting the navigator (R3-27)',
    apply: (root) => edit(root, CONTEXT, `      const response = await authAPI.register(email, password, firstName, lastName, getDeviceTimezone(), locale);`,
      `      setLoading(true);
      const response = await authAPI.register(email, password, firstName, lastName, getDeviceTimezone(), locale);
      setLoading(false);`),
    expect: /● .*keeps the form mounted while registration waits: busy, never loading/ },
  { id: 'english-under-fields', description: 'the form prints the server message under the fields (R3-25)',
    apply: (root) => edit(root, REGISTER, '{authErrorMessage(t, error)}</Text>', '{error.message}</Text>'),
    expect: /● .*shows a failure under the fields in the app language, never the server English/ },
  { id: 'name-code-unmapped', description: 'NAME_INVALID falls back to the server English (R3-25)',
    apply: (root) => edit(root, 'src/features/auth/utils/authErrors.ts', `    case 'NAME_INVALID':
`, ''),
    expect: /● .*names the server name rule rather than repeating its English/ },
  { id: 'bytes-unchecked', description: 'the form lets a password over 72 bytes through (R3-25)',
    apply: (root) => edit(root, REGISTER, 'if (password.length < 8 || utf8Length(password) > 72) {', 'if (password.length < 8) {'),
    expect: /● .*stops a name of spaces and an over-long password before asking the server/ },
  { id: 'subtitle-claims-send', description: 'the code screen says a code went out whatever the delivery (R3-26)',
    apply: (root) => edit(root, VERIFY, `              {delivery === 'sent' ? t.auth.verifySubtitle(pendingEmail)
                : delivery ? t.auth.verifySubtitleUnsent(pendingEmail)
                  : t.auth.emailNotVerified}`, `              {delivery ? t.auth.verifySubtitle(pendingEmail) : t.auth.emailNotVerified}`),
    expect: /● .*does not claim a code went out when the email was refused or unanswered/ },
];

const results = [];
for (const mutation of mutations) {
  const parent = mkdtempSync(path.join(process.env.TMPDIR || tmpdir(), `r3-client-mutation-${mutation.id}-`));
  const root = path.join(parent, 'app');
  try {
    for (const entry of ['src', 'shared', 'jest.config.js', 'package.json', 'tsconfig.json', 'app.json']) {
      cpSync(path.join(app, entry), path.join(root, entry), { recursive: true });
    }
    symlinkSync(path.join(app, 'node_modules'), path.join(root, 'node_modules'));
    if (mutation.apply) mutation.apply(root);
    const started = Date.now();
    const run = spawnSync(process.execPath, jest, { cwd: root, encoding: 'utf8', timeout: 300000,
      maxBuffer: 16 * 1024 * 1024, env: { PATH: process.env.PATH, HOME: process.env.HOME } });
    const output = `${run.stdout}\n${run.stderr}`;
    const failed = run.status !== 0;
    // A copy that cannot compile or load its modules shows nothing about the behaviour.
    const loadFailure = /Test suite failed to run|does not provide an export named|Cannot find module/.test(output);
    const caught = mutation.expect === 'pass' ? !failed : failed && !loadFailure && mutation.expect.test(output);
    results.push(caught);
    console.log(JSON.stringify({ mutation: mutation.id, description: mutation.description,
      detail: { exit: run.status, seconds: Math.round((Date.now() - started) / 100) / 10,
        tests: (output.match(/Tests:\s+[^\n]+/) || [null])[0],
        firstFailure: (output.split('\n').find((line) => /● .*›|● [a-z]/.test(line)) || '').trim().slice(0, 160) || null },
      loadFailure, expected: mutation.expect === 'pass' ? 'all pass' : 'guard test fails', result: caught ? 'PASS' : 'FAIL' }));
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}
const failures = results.filter((ok) => !ok).length;
console.log(JSON.stringify({ summary: failures ? 'FAIL' : 'PASS', mutations: results.length, failures }));
process.exitCode = failures ? 1 : 0;
