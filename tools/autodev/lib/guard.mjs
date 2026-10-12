/**
 * What the loop must not carry on with alone (owner's decision, 2026-10-07):
 * migrations, data deletion, auth and security, production, keys. Read off
 * the files a task changed and the lines it added; anything that matches
 * pauses the task for the owner before review or push.
 *
 * Deliberately wide: a pause costs the owner a look, a miss costs production.
 */

const PATHS = [
  [/(^|\/)migrations\//, 'миграции'],
  [/(^|\/)database\/.*\.sql$/, 'схема БД'],
  [/\.sql$/, 'SQL-файл'],
  [/(^|\/)\.env(\.|$)/, '.env'],
  [/(^|\/)vercel\.json$/, 'деплой (vercel.json)'],
  [/(^|\/)\.github\/workflows\//, 'CI/расписания'],
  [/(^|\/)routes\/(auth|emailChange|emailVerification|passwordReset)\.js$/, 'авторизация'],
  [/(^|\/)middleware\/(jwtMiddleware|adminAuth|auth)[^/]*\.js$/, 'авторизация'],
  [/(^|\/)utils\/(accountLinking|oauthVerification)\.js$/, 'вход через Google/Apple'],
  [/(^|\/)services\/email\//, 'подтверждение почты'],
  // The app's side of signing in is auth too: screens, session, stored tokens.
  [/(^|\/)src\/features\/auth\//, 'вход в приложении'],
  [/(^|\/)src\/contexts\/AuthContext/, 'сессия в приложении'],
  [/(^|\/)src\/shared\/services\/(googleAuth|appleAuth|auth)[^/]*$/, 'вход через Google/Apple в приложении'],
  [/(^|\/)src\/shared\/(utils|services)\/[^/]*(token|secureStore|credential)[^/]*$/i, 'хранение токенов'],
  [/(^|\/)config\/(env|tokenTtl|appleAuth)\.js$/, 'конфигурация безопасности'],
  [/(^|\/)ios\//, 'нативная часть iOS'],
  [/(^|\/)app\.json$/, 'конфигурация приложения'],
  [/(^|\/)tools\/autodev\//, 'сам супервизор'],
  [/(^|\/)\.claude\//, 'настройки Claude'],
  [/(^|\/)audit\/PRODUCTION_ACCESS\.md$/, 'правила доступа к production'],
];

const ADDED = [
  [/rehearsly\.me|neon\.tech|vercel\.app/i, 'адрес production'],
  [/\bDROP\s+(TABLE|COLUMN|SCHEMA)\b|\bTRUNCATE\b/i, 'удаление данных'],
  [/\bDELETE\s+FROM\b(?![^\n]*\bWHERE\b)/i, 'DELETE без WHERE'],
  [/BEGIN [A-Z ]*PRIVATE KEY|sk-[A-Za-z0-9]{20,}|re_[A-Za-z0-9]{20,}/, 'похоже на ключ'],
  [/\bgit push\b/, 'git push в коде'],
];

const TEST_ID = /\s*testID=(\{[^}]*\}|"[^"]*"|'[^']*')/g;

/**
 * A change to app code that only adds or moves `testID`s — the handles e2e
 * flows find controls by — and touches nothing else. T-304 put four of them
 * on the sign-in screens and waited a day for the owner (2026-10-11/12).
 */
export function testIdsOnly(change) {
  if (!change) return false;
  const strip = (lines) => lines.map((line) => line.replace(TEST_ID, '').trim()).filter(Boolean).sort();
  const added = strip(change.added);
  const removed = strip(change.removed);
  return added.length === removed.length && added.every((line, i) => line === removed[i]);
}

/**
 * @param files paths changed by the task (relative to the repository root)
 * @param addedLines lines the diff adds
 * @param changes per file, {added, removed} — app files changed only by
 *   testIDs are not a reason (testIdsOnly)
 * @returns reasons to pause, empty when the task may go on
 */
export function pauseReasons(files, addedLines, changes = {}) {
  const reasons = new Set();
  for (const file of files) {
    if (/(^|\/)src\//.test(file) && testIdsOnly(changes[file])) continue;
    for (const [pattern, reason] of PATHS) if (pattern.test(file)) reasons.add(`${reason}: ${file}`);
  }
  for (const line of addedLines) {
    for (const [pattern, reason] of ADDED) if (pattern.test(line)) reasons.add(`${reason}: ${line.trim().slice(0, 120)}`);
  }
  return [...reasons];
}

/** The kind of change a reason names — "сессия в приложении", "миграции" — without its file or line. */
export function reasonKind(reason) {
  return reason.split(': ')[0];
}

/**
 * The reasons whose kind the owner has not yet allowed this task. "Продолжить"
 * allows a task the kinds it stopped on, so its next rounds — the reviewer's
 * notes fixed in the same auth files — do not stop again; a kind it has not
 * shown before (a migration, the server) still does (T-130, 2026-10-10).
 */
export function unapproved(reasons, approvedKinds = []) {
  return reasons.filter((reason) => !approvedKinds.includes(reasonKind(reason)));
}

/** Changed files and added lines from `git diff --unified=0` output. */
export function parseDiff(diffText) {
  const files = new Set();
  const added = [];
  const changes = {};
  let current = null;
  for (const line of diffText.split('\n')) {
    const header = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
    if (header) { current = header[2]; changes[current] = { added: [], removed: [] }; continue; }
    const file = /^\+\+\+ b\/(.+)$/.exec(line) || /^--- a\/(.+)$/.exec(line);
    if (file) { files.add(file[1]); continue; }
    if (line.startsWith('+++') || line.startsWith('---')) continue;
    if (line.startsWith('+')) { added.push(line.slice(1)); changes[current]?.added.push(line.slice(1)); }
    else if (line.startsWith('-')) changes[current]?.removed.push(line.slice(1));
  }
  return { files: [...files], added, changes };
}
