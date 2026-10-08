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

/**
 * @param files paths changed by the task (relative to the repository root)
 * @param addedLines lines the diff adds
 * @returns reasons to pause, empty when the task may go on
 */
export function pauseReasons(files, addedLines) {
  const reasons = new Set();
  for (const file of files) {
    for (const [pattern, reason] of PATHS) if (pattern.test(file)) reasons.add(`${reason}: ${file}`);
  }
  for (const line of addedLines) {
    for (const [pattern, reason] of ADDED) if (pattern.test(line)) reasons.add(`${reason}: ${line.trim().slice(0, 120)}`);
  }
  return [...reasons];
}

/** Changed files and added lines from `git diff --unified=0` output. */
export function parseDiff(diffText) {
  const files = new Set();
  const added = [];
  for (const line of diffText.split('\n')) {
    const file = /^\+\+\+ b\/(.+)$/.exec(line) || /^--- a\/(.+)$/.exec(line);
    if (file) { files.add(file[1]); continue; }
    if (line.startsWith('+') && !line.startsWith('+++')) added.push(line.slice(1));
  }
  return { files: [...files], added };
}
